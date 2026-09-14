import { SAFETY_CATEGORIES, type SafetyCategory } from "@/content/safety";
import { CLASSIFIER_SYSTEM, CLASSIFY_TOOL, INTERPRETATION_SYSTEM, READING_TOOL, classifierUserMessage, interpretationUserMessage } from "./prompts";
import type { GenerationProvider, InterpretationInput, ProviderOutcome } from "./types";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

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
  ) {}

  async classify(question: string): Promise<ProviderOutcome<SafetyCategory>> {
    const outcome = await this.callJson(this.models.classifier, CLASSIFIER_SYSTEM, classifierUserMessage(question), CLASSIFY_TOOL.input_schema, 1024);
    if (!outcome.ok) return outcome;
    const category = (outcome.value as { category?: unknown })?.category;
    if (typeof category !== "string" || !(SAFETY_CATEGORIES as readonly string[]).includes(category)) {
      return { ok: false, reason: "classifier_invalid_output", retryable: true, uncertain: false };
    }
    return { ...outcome, value: category as SafetyCategory };
  }

  interpret(input: InterpretationInput): Promise<ProviderOutcome<unknown>> {
    return this.callJson(this.models.answer, INTERPRETATION_SYSTEM, interpretationUserMessage(input), READING_TOOL.input_schema, 8192);
  }

  private async callJson(model: string, system: string, user: string, schema: unknown, maxOutputTokens: number): Promise<ProviderOutcome<unknown>> {
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": this.apiKey, "content-type": "application/json", "user-agent": "Tarotova/0.2" },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema), maxOutputTokens },
        }),
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
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
