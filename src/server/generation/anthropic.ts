import { SAFETY_CATEGORIES, type SafetyCategory } from "@/content/safety";
import { CLASSIFIER_SYSTEM, CLASSIFY_TOOL, INTERPRETATION_SYSTEM, READING_TOOL, classifierUserMessage, interpretationUserMessage } from "./prompts";
import type { GenerationProvider, InterpretationInput, ProviderOutcome } from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

interface ToolCall {
  name: string;
  description: string;
  input_schema: object;
}

/**
 * Anthropic Messages API over plain fetch (no SDK), the same shape as the
 * Resend provider: bounded by a timeout, structured through forced tool
 * use, and honest about what a failure means. The API offers no
 * idempotency key, so the attempt cap in the service is the only guard
 * against a double paid call (docs/REVIEW-V2.md, adopted adjustments).
 */
export class AnthropicProvider implements GenerationProvider {
  readonly name = "anthropic";
  constructor(
    private readonly apiKey: string,
    private readonly models: { answer: string; classifier: string },
    private readonly timeoutMs: number,
    private readonly workspaceId?: string,
  ) {}

  async classify(question: string): Promise<ProviderOutcome<SafetyCategory>> {
    const outcome = await this.callTool(this.models.classifier, CLASSIFIER_SYSTEM, classifierUserMessage(question), CLASSIFY_TOOL, 64);
    if (!outcome.ok) return outcome;
    const category = (outcome.value as { category?: unknown }).category;
    if (typeof category !== "string" || !(SAFETY_CATEGORIES as readonly string[]).includes(category)) {
      return { ok: false, reason: "classifier_invalid_output", retryable: true, uncertain: false };
    }
    return { ...outcome, value: category as SafetyCategory };
  }

  interpret(input: InterpretationInput): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, INTERPRETATION_SYSTEM, interpretationUserMessage(input), READING_TOOL, 1200);
  }

  private async callTool(model: string, system: string, user: string, tool: ToolCall, maxTokens: number): Promise<ProviderOutcome<unknown>> {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": API_VERSION,
          "content-type": "application/json",
          "user-agent": "Tarotova/0.2",
          // An organization-level key must name the workspace to bill; a
          // workspace-scoped key ignores the header.
          ...(this.workspaceId ? { "anthropic-workspace-id": this.workspaceId } : {}),
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
          tools: [tool],
          tool_choice: { type: "tool", name: tool.name },
        }),
      });
    } catch (err) {
      // The request may have been received and billed before the timeout —
      // the caller treats this as a spent attempt.
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      return { ok: false, reason: timedOut ? "provider_timeout" : "provider_network", retryable: true, uncertain: timedOut };
    }

    if (!res.ok) {
      const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
      // Anthropic error bodies are {type:"error", error:{type, message}}; the
      // message names the cause (billing, bad model id, schema) and never
      // echoes the key or the prompt, so it is safe to keep for diagnostics.
      let detail: string | undefined;
      try {
        const body = (await res.json()) as { error?: { type?: string; message?: string } };
        if (body.error) detail = [body.error.type, body.error.message].filter(Boolean).join(": ").slice(0, 300);
      } catch {
        // No JSON body; the status alone will have to do.
      }
      return { ok: false, reason: `provider_http_${res.status}`, detail, retryable, uncertain: false };
    }

    let body: { content?: { type: string; name?: string; input?: unknown }[]; usage?: { input_tokens?: number; output_tokens?: number }; model?: string };
    try {
      body = await res.json();
    } catch {
      return { ok: false, reason: "provider_invalid_json", retryable: true, uncertain: false };
    }
    const call = body.content?.find((block) => block.type === "tool_use" && block.name === tool.name);
    if (!call || call.input === undefined) return { ok: false, reason: "provider_no_tool_call", retryable: true, uncertain: false };
    return {
      ok: true,
      value: call.input,
      model: body.model ?? model,
      usage: body.usage ? { inputTokens: body.usage.input_tokens ?? 0, outputTokens: body.usage.output_tokens ?? 0 } : undefined,
    };
  }
}
