import { SAFETY_CATEGORIES, type SafetyCategory } from "@/content/safety";
import { CLASSIFIER_SYSTEM, CLASSIFY_TOOL, INTERPRETATION_SYSTEM, READING_TOOL, classifierUserMessage, interpretationUserMessage } from "./prompts";
import { GROUNDING_SYSTEM, GROUNDING_TOOL, REPAIR_SYSTEM, REPAIR_TOOL, groundingUserMessage } from "./grounding-prompts";
import { callTimeout, deadlineExceeded } from "./deadline";
import type { GenerationProvider, GroundingIssue, InterpretationInput, InterpretationOutput, ProviderCallOptions, ProviderOutcome } from "./types";

const ENDPOINT = "https://api.deepseek.com/chat/completions";

interface ToolCall {
  name: string;
  description: string;
  input_schema: object;
}

/**
 * DeepSeek over its OpenAI-compatible chat API, plain fetch. Structured
 * through a forced function call with thinking disabled: the V4 models
 * think by default and refuse a forced tool_choice in that mode (verified
 * live on 2026-09-15). Same contract as the other adapters: bounded by the
 * shared deadline, honest about what a failure means, never logs the prompt.
 */
export class DeepSeekProvider implements GenerationProvider {
  readonly name = "deepseek";
  constructor(
    private readonly apiKey: string,
    private readonly models: { answer: string; classifier: string },
    private readonly timeoutMs: number,
  ) {}

  async classify(question: string, options?: ProviderCallOptions): Promise<ProviderOutcome<SafetyCategory>> {
    const outcome = await this.callTool(this.models.classifier, CLASSIFIER_SYSTEM, classifierUserMessage(question), CLASSIFY_TOOL, 64, options);
    if (!outcome.ok) return outcome;
    const category = (outcome.value as { category?: unknown })?.category;
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

  private async callTool(model: string, system: string, user: string, tool: ToolCall, maxTokens: number, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    const timeoutMs = callTimeout(this.timeoutMs, options);
    if (timeoutMs <= 0) return deadlineExceeded();
    const signal = AbortSignal.timeout(timeoutMs);
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json", "user-agent": "Tarotova/0.2" },
        signal,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          thinking: { type: "disabled" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }],
          tool_choice: { type: "function", function: { name: tool.name } },
        }),
      });
    } catch (err) {
      const timedOut = signal.aborted || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"));
      return { ok: false, reason: timedOut ? "provider_timeout" : "provider_network", retryable: true, uncertain: timedOut };
    }

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      let detail: string | undefined;
      try {
        const body = (await res.json()) as { error?: { type?: string; code?: string; message?: string } };
        if (body.error) detail = [body.error.type ?? body.error.code, body.error.message].filter(Boolean).join(": ").slice(0, 300);
      } catch {
        // No JSON body; the status alone will have to do.
      }
      return { ok: false, reason: `provider_http_${res.status}`, detail, retryable, uncertain: false };
    }

    let body: {
      model?: string;
      choices?: { finish_reason?: string; message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      body = await res.json();
    } catch {
      if (signal.aborted) return { ok: false, reason: "provider_timeout", retryable: true, uncertain: true };
      return { ok: false, reason: "provider_invalid_json", retryable: true, uncertain: false };
    }
    const choice = body.choices?.[0];
    if (choice?.finish_reason === "content_filter") return { ok: false, reason: "provider_blocked", detail: "content_filter", retryable: false, uncertain: false };
    if (choice?.finish_reason === "length") return { ok: false, reason: "provider_finish_max_tokens", retryable: true, uncertain: false };
    const call = choice?.message?.tool_calls?.find((c) => c.function?.name === tool.name);
    if (!call?.function?.arguments) return { ok: false, reason: "provider_no_tool_call", retryable: true, uncertain: false };
    let value: unknown;
    try {
      value = JSON.parse(call.function.arguments);
    } catch {
      return { ok: false, reason: "provider_invalid_json", retryable: true, uncertain: false };
    }
    return {
      ok: true,
      value,
      model: body.model ?? model,
      usage: body.usage ? { inputTokens: body.usage.prompt_tokens ?? 0, outputTokens: body.usage.completion_tokens ?? 0 } : undefined,
    };
  }
}
