import { SAFETY_CATEGORIES, type SafetyCategory } from "@/content/safety";
import { CLASSIFY_TOOL, FOLLOWUP_SYSTEM, FOLLOWUP_TOOL, INTERPRETATION_SYSTEM, READING_TOOL, classifierSystem, classifierUserMessage, followupUserMessage, interpretationUserMessage } from "./prompts";
import type { ConversationContext, FollowupInput, FollowupOutput, GenerationProvider, GroundingIssue, InterpretationInput, InterpretationOutput, ProviderCallOptions, ProviderOutcome } from "./types";
import { FOLLOWUP_GROUNDING_SYSTEM, FOLLOWUP_GROUNDING_TOOL, FOLLOWUP_REPAIR_SYSTEM, FOLLOWUP_REPAIR_TOOL, GROUNDING_SYSTEM, GROUNDING_TOOL, REPAIR_SYSTEM, REPAIR_TOOL, followupGroundingUserMessage, groundingUserMessage } from "./grounding-prompts";

import { callTimeout, deadlineExceeded } from "./deadline";

const DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/messages";
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
    /** Tests only: a local server that stalls, to prove the timeout ends the call. */
    private readonly endpoint: string = DEFAULT_ENDPOINT,
    /**
     * Prompt caching for the (identical, long) system prompts: "5m" or
     * "1h". Off by default. A cache write costs 1.25x (5m) or 2x (1h) the
     * plain input price and a read 0.1x, so at low traffic caching costs
     * more, not less; the usage fields let the eval and logs measure it.
     */
    private readonly promptCache?: "5m" | "1h",
  ) {}

  async classify(question: string, options?: ProviderCallOptions, context?: ConversationContext): Promise<ProviderOutcome<SafetyCategory>> {
    const outcome = await this.callTool(this.models.classifier, classifierSystem(context), classifierUserMessage(question, context), CLASSIFY_TOOL, 64, options);
    if (!outcome.ok) return outcome;
    const category = (outcome.value as { category?: unknown }).category;
    if (typeof category !== "string" || !(SAFETY_CATEGORIES as readonly string[]).includes(category)) {
      return { ok: false, reason: "classifier_invalid_output", retryable: true, uncertain: false };
    }
    return { ...outcome, value: category as SafetyCategory };
  }

  interpret(input: InterpretationInput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, INTERPRETATION_SYSTEM, interpretationUserMessage(input), READING_TOOL, 1200, options);
  }

  review(input: InterpretationInput, answer: InterpretationOutput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, GROUNDING_SYSTEM, groundingUserMessage(input, answer), GROUNDING_TOOL, 2000, options);
  }

  repair(input: InterpretationInput, answer: InterpretationOutput, issues: GroundingIssue[], options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, REPAIR_SYSTEM, groundingUserMessage(input, answer, issues), REPAIR_TOOL, 1800, options);
  }

  followup(input: FollowupInput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, FOLLOWUP_SYSTEM, followupUserMessage(input), FOLLOWUP_TOOL, 900, options);
  }

  reviewFollowup(input: FollowupInput, answer: FollowupOutput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, FOLLOWUP_GROUNDING_SYSTEM, followupGroundingUserMessage(input, answer), FOLLOWUP_GROUNDING_TOOL, 2000, options);
  }

  repairFollowup(input: FollowupInput, answer: FollowupOutput, issues: GroundingIssue[], options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, FOLLOWUP_REPAIR_SYSTEM, followupGroundingUserMessage(input, answer, issues), FOLLOWUP_REPAIR_TOOL, 1200, options);
  }

  private async callTool(model: string, system: string, user: string, tool: ToolCall, maxTokens: number, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    const timeoutMs = callTimeout(this.timeoutMs, options);
    if (timeoutMs <= 0) return deadlineExceeded();
    const signal = AbortSignal.timeout(timeoutMs);
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
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
        signal,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: this.promptCache
            ? [{ type: "text", text: system, cache_control: this.promptCache === "1h" ? { type: "ephemeral", ttl: "1h" } : { type: "ephemeral" } }]
            : system,
          messages: [{ role: "user", content: user }],
          tools: [tool],
          tool_choice: { type: "tool", name: tool.name },
        }),
      });
    } catch (err) {
      // The request may have been received and billed before the timeout —
      // the caller treats this as a spent attempt.
      const timedOut = signal.aborted || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"));
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

    let body: {
      stop_reason?: string;
      content?: { type: string; name?: string; input?: unknown }[];
      usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
      model?: string;
    };
    try {
      body = await res.json();
    } catch {
      if (signal.aborted) return { ok: false, reason: "provider_timeout", retryable: true, uncertain: true };
      return { ok: false, reason: "provider_invalid_json", retryable: true, uncertain: false };
    }
    if (body.stop_reason === "refusal") return { ok: false, reason: "provider_refused", retryable: false, uncertain: false };
    const call = body.content?.find((block) => block.type === "tool_use" && block.name === tool.name);
    if (!call || call.input === undefined) return { ok: false, reason: "provider_no_tool_call", retryable: true, uncertain: false };
    return {
      ok: true,
      value: call.input,
      model: body.model ?? model,
      usage: body.usage
        ? {
            inputTokens: body.usage.input_tokens ?? 0,
            outputTokens: body.usage.output_tokens ?? 0,
            ...(body.usage.cache_creation_input_tokens ? { cacheWriteTokens: body.usage.cache_creation_input_tokens } : {}),
            ...(body.usage.cache_read_input_tokens ? { cacheReadTokens: body.usage.cache_read_input_tokens } : {}),
          }
        : undefined,
    };
  }
}
