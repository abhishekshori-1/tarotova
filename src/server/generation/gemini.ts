import { SAFETY_CATEGORIES, type SafetyCategory } from "@/content/safety";
import { CLASSIFY_TOOL, FOLLOWUP_SYSTEM, FOLLOWUP_TOOL, INTERPRETATION_SYSTEM, READING_TOOL, classifierSystem, classifierUserMessage, followupUserMessage, interpretationUserMessage } from "./prompts";
import type { ConversationContext, FollowupInput, FollowupOutput, GenerationProvider, GroundingIssue, InterpretationInput, InterpretationOutput, ProviderCallOptions, ProviderOutcome } from "./types";
import { FOLLOWUP_GROUNDING_SYSTEM, FOLLOWUP_GROUNDING_TOOL, FOLLOWUP_REPAIR_SYSTEM, FOLLOWUP_REPAIR_TOOL, GROUNDING_SYSTEM, GROUNDING_TOOL, REPAIR_SYSTEM, REPAIR_TOOL, followupGroundingUserMessage, groundingUserMessage } from "./grounding-prompts";

import { callTimeout, deadlineExceeded } from "./deadline";

const DEFAULT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Gemini's `responseSchema` is an OpenAPI subset: no `additionalProperties`,
 * and a nullable field is `nullable: true` rather than a type array. The
 * same tool schemas drive both providers, converted here.
 */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === "additionalProperties") continue;
    if (key === "type" && Array.isArray(value)) {
      const types = value.filter((t) => t !== "null");
      out.type = types[0];
      if (types.length !== value.length) out.nullable = true;
      continue;
    }
    out[key] = key === "properties" || key === "items" ? toGeminiSchema(value) : Array.isArray(value) ? value : typeof value === "object" && value ? toGeminiSchema(value) : value;
  }
  return out;
}

/**
 * Gemini over plain fetch, structured through JSON-mode output with the
 * converted tool schema. Same contract as the Anthropic adapter: bounded by
 * a timeout, honest about what a failure means, never logs the prompt.
 */
export class GeminiProvider implements GenerationProvider {
  readonly name = "gemini";
  constructor(
    private readonly apiKey: string,
    private readonly models: { answer: string; classifier: string },
    private readonly timeoutMs: number,
    /** Tests only: a local server that stalls, to prove the timeout ends the call. */
    private readonly endpoint: string = DEFAULT_ENDPOINT,
  ) {}

  async classify(question: string, options?: ProviderCallOptions, context?: ConversationContext): Promise<ProviderOutcome<SafetyCategory>> {
    const outcome = await this.callJson(this.models.classifier, classifierSystem(context), classifierUserMessage(question, context), CLASSIFY_TOOL.input_schema, 1024, options);
    if (!outcome.ok) return outcome;
    const category = (outcome.value as { category?: unknown })?.category;
    if (typeof category !== "string" || !(SAFETY_CATEGORIES as readonly string[]).includes(category)) {
      return { ok: false, reason: "classifier_invalid_output", retryable: true, uncertain: false };
    }
    return { ...outcome, value: category as SafetyCategory };
  }

  interpret(input: InterpretationInput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callJson(this.models.answer, INTERPRETATION_SYSTEM, interpretationUserMessage(input), READING_TOOL.input_schema, 8192, options);
  }

  review(input: InterpretationInput, answer: InterpretationOutput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callJson(this.models.answer, GROUNDING_SYSTEM, groundingUserMessage(input, answer), GROUNDING_TOOL.input_schema, 4096, options);
  }

  repair(input: InterpretationInput, answer: InterpretationOutput, issues: GroundingIssue[], options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callJson(this.models.answer, REPAIR_SYSTEM, groundingUserMessage(input, answer, issues), REPAIR_TOOL.input_schema, 8192, options);
  }

  followup(input: FollowupInput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callJson(this.models.answer, FOLLOWUP_SYSTEM, followupUserMessage(input), FOLLOWUP_TOOL.input_schema, 4096, options);
  }

  reviewFollowup(input: FollowupInput, answer: FollowupOutput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callJson(this.models.answer, FOLLOWUP_GROUNDING_SYSTEM, followupGroundingUserMessage(input, answer), FOLLOWUP_GROUNDING_TOOL.input_schema, 4096, options);
  }

  repairFollowup(input: FollowupInput, answer: FollowupOutput, issues: GroundingIssue[], options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callJson(this.models.answer, FOLLOWUP_REPAIR_SYSTEM, followupGroundingUserMessage(input, answer, issues), FOLLOWUP_REPAIR_TOOL.input_schema, 4096, options);
  }

  private async callJson(model: string, system: string, user: string, schema: unknown, maxOutputTokens: number, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    const timeoutMs = callTimeout(this.timeoutMs, options);
    if (timeoutMs <= 0) return deadlineExceeded();
    const signal = AbortSignal.timeout(timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.endpoint}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": this.apiKey, "content-type": "application/json", "user-agent": "Tarotova/0.2" },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema), maxOutputTokens },
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
        const body = (await res.json()) as { error?: { status?: string; message?: string } };
        if (body.error) detail = [body.error.status, body.error.message].filter(Boolean).join(": ").slice(0, 300);
      } catch {
        // No JSON body; the status alone will have to do.
      }
      return { ok: false, reason: `provider_http_${res.status}`, detail, retryable, uncertain: false };
    }

    let body: {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      modelVersion?: string;
    };
    try {
      body = await res.json();
    } catch {
      if (signal.aborted) return { ok: false, reason: "provider_timeout", retryable: true, uncertain: true };
      return { ok: false, reason: "provider_invalid_json", retryable: true, uncertain: false };
    }
    if (body.promptFeedback?.blockReason) {
      return { ok: false, reason: "provider_blocked", detail: body.promptFeedback.blockReason, retryable: false, uncertain: false };
    }
    const candidate = body.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (candidate?.finishReason && candidate.finishReason !== "STOP") {
      return { ok: false, reason: `provider_finish_${candidate.finishReason.toLowerCase()}`, retryable: candidate.finishReason === "MAX_TOKENS", uncertain: false };
    }
    if (!text.trim()) return { ok: false, reason: "provider_empty_response", retryable: true, uncertain: false };
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return { ok: false, reason: "provider_invalid_json", retryable: true, uncertain: false };
    }
    return {
      ok: true,
      value,
      model: body.modelVersion ?? model,
      usage: body.usageMetadata ? { inputTokens: body.usageMetadata.promptTokenCount ?? 0, outputTokens: body.usageMetadata.candidatesTokenCount ?? 0 } : undefined,
    };
  }
}
