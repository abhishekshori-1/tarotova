import { SAFETY_CATEGORIES, type SafetyCategory } from "@/content/safety";
import { POSITIONS } from "@/content/types";
import { CLASSIFY_TOOL, FOLLOWUP_SYSTEM, FOLLOWUP_TOOL, INTERPRETATION_SYSTEM, READING_TOOL, classifierSystem, classifierUserMessage, followupUserMessage, interpretationUserMessage } from "./prompts";
import { FOLLOWUP_GROUNDING_SYSTEM, FOLLOWUP_GROUNDING_TOOL, FOLLOWUP_REPAIR_SYSTEM, FOLLOWUP_REPAIR_TOOL, GROUNDING_SYSTEM, GROUNDING_TOOL, REPAIR_SYSTEM, REPAIR_TOOL, followupGroundingUserMessage, groundingUserMessage, repairFields, repairToolFor } from "./grounding-prompts";
import { callTimeout, deadlineExceeded, networkDetail } from "./deadline";
import { type ConversationContext, type FollowupInput, type FollowupOutput, type GenerationProvider, type GroundingIssue, type InterpretationInput, type InterpretationOutput, type ProviderCallOptions, type ProviderOutcome, type UserMessage, userMessageText } from "./types";

/**
 * DeepSeek occasionally returns the tool arguments wrapped one level deep,
 * as {"parameters": {...}} or {"arguments": {...}}: the same content, one
 * envelope too many. Unwrap that single known envelope and nothing else; the
 * validator still judges the result.
 */
export function unwrapArguments(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length !== 1 || !["parameters", "arguments", "input"].includes(keys[0])) return value;
  const inner = (value as Record<string, unknown>)[keys[0]];
  return inner && typeof inner === "object" && !Array.isArray(inner) ? inner : value;
}

/** A fenced ```json block is the one decoration JSON mode still produces now and then; the content inside is parsed as-is. */
export function stripFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : trimmed;
}

const DEFAULT_ENDPOINT = "https://api.deepseek.com/beta/chat/completions";

/** DeepSeek strict tools support anyOf, but not length/item-count keywords.
 * Keep those limits in our shared validator; remove only unsupported schema
 * keywords from transport. https://api-docs.deepseek.com/guides/tool_calls/
 */
export function deepseekStrictSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepseekStrictSchema);
  if (!value || typeof value !== "object") return value;
  const schema = Object.fromEntries(Object.entries(value).filter(([key]) => !["minItems", "maxItems", "minLength", "maxLength"].includes(key)).map(([key, item]) => [key, deepseekStrictSchema(item)]));
  if (Array.isArray(schema.type)) {
    schema.anyOf = schema.type.map((type: string) => ({ type }));
    delete schema.type;
  }
  return schema;
}

interface ToolCall {
  name: string;
  description: string;
  input_schema: object;
}

/** The nullable-string branch produced unquoted prose in captured strict-mode
 * replies. Use an empty JSON string for absence on this transport only. The
 * public/stored schema remains nullable, and malformed JSON is still rejected.
 */
function textOptionalFields(tool: ToolCall): string[] {
  if (tool.name === READING_TOOL.name) return ["beyondSpread"];
  if (tool.name === FOLLOWUP_TOOL.name) return ["reflection", "beyondSpread"];
  return [];
}

function transportSchema(tool: ToolCall, fields: string[]): object {
  if (!fields.length) return tool.input_schema;
  const schema = tool.input_schema as { properties: Record<string, { description?: string }> };
  return { ...schema, properties: { ...schema.properties, ...Object.fromEntries(fields.map((field) => [field, {
    ...schema.properties[field], type: "string",
    description: `${schema.properties[field].description ?? ""} For this transport use the empty JSON string when absent, otherwise a quoted JSON string.`,
  }])) } };
}

function restoreOptionalText(value: unknown, fields: string[]): unknown {
  if (!fields.length || !value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(record).map(([key, text]) => [key, fields.includes(key) && text === "" ? null : text]));
}

/** Flat position fields avoid the nested-card envelope drifting into other fields.
 * This changes only transport: stored answers and the validator keep their
 * canonical ordered array. No text is supplied, renamed or inferred.
 */
const DEEPSEEK_READING_TOOL: ToolCall = {
  ...READING_TOOL,
  input_schema: {
    ...READING_TOOL.input_schema,
    required: ["perspective", ...POSITIONS, "synthesis", "reflection", "beyondSpread"],
    properties: {
      perspective: READING_TOOL.input_schema.properties.perspective,
      ...Object.fromEntries(POSITIONS.map((position) => [position, {
        ...READING_TOOL.input_schema.properties.cards.items.properties.relevance,
        description: `${position}: ${READING_TOOL.input_schema.properties.cards.items.properties.relevance.description}`,
      }])),
      synthesis: READING_TOOL.input_schema.properties.synthesis,
      reflection: READING_TOOL.input_schema.properties.reflection,
      beyondSpread: READING_TOOL.input_schema.properties.beyondSpread,
    },
  },
};

export function canonicalReading(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const reading = value as Record<string, unknown>;
  const flatKeys = ["perspective", ...POSITIONS, "synthesis", "reflection", "beyondSpread"];
  if (Object.keys(reading).length === flatKeys.length && flatKeys.every((key) => Object.hasOwn(reading, key)) && POSITIONS.every((position) => typeof reading[position] === "string")) {
    const { situation, challenge, guidance, ...rest } = reading;
    return { ...rest, cards: [
      { position: "situation", relevance: situation },
      { position: "challenge", relevance: challenge },
      { position: "guidance", relevance: guidance },
    ] };
  }
  // Accept the earlier nested transport only when all three exact text keys exist.
  const cards = reading.cards;
  if (!cards || typeof cards !== "object" || Array.isArray(cards)) return value;
  const fields = cards as Record<string, unknown>;
  if (Object.keys(fields).length !== POSITIONS.length || !POSITIONS.every((position) => typeof fields[position] === "string")) return value;
  return { ...reading, cards: POSITIONS.map((position) => ({ position, relevance: fields[position] })) };
}

/**
 * DeepSeek over its OpenAI-compatible chat API, plain fetch. Structured
 * through strict tool calls with thinking disabled. Same contract as the other adapters: bounded by the
 * shared deadline, honest about what a failure means, never logs the prompt.
 */
export class DeepSeekProvider implements GenerationProvider {
  readonly name = "deepseek";
  constructor(
    private readonly apiKey: string,
    private readonly models: { answer: string; classifier: string },
    private readonly timeoutMs: number,
    /** Tests only: a local server that stalls, to prove the timeout ends the call. */
    private readonly endpoint: string = DEFAULT_ENDPOINT,
  ) {}

  async classify(question: string, options?: ProviderCallOptions, context?: ConversationContext): Promise<ProviderOutcome<SafetyCategory>> {
    const outcome = await this.callTool(this.models.classifier, classifierSystem(context), classifierUserMessage(question, context), CLASSIFY_TOOL, 64, options);
    if (!outcome.ok) return outcome;
    const category = (outcome.value as { category?: unknown })?.category;
    if (typeof category !== "string" || !(SAFETY_CATEGORIES as readonly string[]).includes(category)) {
      return { ok: false, model: outcome.model, usage: outcome.usage, reason: "classifier_invalid_output", retryable: true, uncertain: false };
    }
    return { ...outcome, value: category as SafetyCategory };
  }

  async interpret(input: InterpretationInput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    const outcome = await this.callTool(this.models.answer, INTERPRETATION_SYSTEM, interpretationUserMessage(input), DEEPSEEK_READING_TOOL, 2400, options);
    return outcome.ok ? { ...outcome, value: canonicalReading(outcome.value) } : outcome;
  }

  review(input: InterpretationInput, answer: InterpretationOutput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, GROUNDING_SYSTEM, groundingUserMessage(input, answer), GROUNDING_TOOL, 2000, options);
  }

  repair(input: InterpretationInput, answer: InterpretationOutput, issues: GroundingIssue[], options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, REPAIR_SYSTEM, groundingUserMessage(input, answer, issues), repairToolFor(REPAIR_TOOL, repairFields(issues)), 2400, options);
  }

  followup(input: FollowupInput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, FOLLOWUP_SYSTEM, followupUserMessage(input), FOLLOWUP_TOOL, 1600, options);
  }

  reviewFollowup(input: FollowupInput, answer: FollowupOutput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, FOLLOWUP_GROUNDING_SYSTEM, followupGroundingUserMessage(input, answer), FOLLOWUP_GROUNDING_TOOL, 2000, options);
  }

  repairFollowup(input: FollowupInput, answer: FollowupOutput, issues: GroundingIssue[], options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.callTool(this.models.answer, FOLLOWUP_REPAIR_SYSTEM, followupGroundingUserMessage(input, answer, issues), repairToolFor(FOLLOWUP_REPAIR_TOOL, repairFields(issues)), 1800, options);
  }

  private async callTool(model: string, system: string, user: UserMessage, tool: ToolCall, maxTokens: number, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    const timeoutMs = callTimeout(this.timeoutMs, options);
    if (timeoutMs <= 0) return deadlineExceeded();
    const signal = AbortSignal.timeout(timeoutMs);
    const optionalFields = textOptionalFields(tool);
    const transportSystem = optionalFields.length
      ? `${system}\n\nTransport format: ${optionalFields.join(" and ")} are JSON strings in this operation. Where the instructions say null for these fields, send the empty JSON string instead. Nonempty text must also be quoted as a valid JSON string.`
      : system;
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json", "user-agent": "Tarotova/0.2" },
        signal,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          thinking: { type: "disabled" },
          // Plain JSON mode allowed missing/nested fields in the longer
          // reading. Strict mode constrains shape without another paid call.
          tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: deepseekStrictSchema(transportSchema(tool, optionalFields)), strict: true } }],
          tool_choice: { type: "function", function: { name: tool.name } },
          messages: [
            { role: "system", content: transportSystem },
            { role: "user", content: userMessageText(user) },
          ],
        }),
      });
    } catch (err) {
      const timedOut = signal.aborted || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"));
      return { ok: false, model, reason: timedOut ? "provider_timeout" : "provider_network", detail: networkDetail(err), retryable: true, uncertain: timedOut };
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
      return { ok: false, model, reason: `provider_http_${res.status}`, detail, retryable, uncertain: false };
    }

    let body: {
      model?: string;
      choices?: { finish_reason?: string; message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number };
    };
    try {
      body = await res.json();
    } catch {
      if (signal.aborted) return { ok: false, model, reason: "provider_timeout", retryable: true, uncertain: true };
      return { ok: false, model, reason: "provider_invalid_json", detail: "response_body_invalid_json", retryable: true, uncertain: false };
    }
    const metadata = {
      model: body.model ?? model,
      usage: body.usage ? {
        inputTokens: body.usage.prompt_cache_miss_tokens ?? Math.max(0, (body.usage.prompt_tokens ?? 0) - (body.usage.prompt_cache_hit_tokens ?? 0)),
        outputTokens: body.usage.completion_tokens ?? 0,
        ...(body.usage.prompt_cache_hit_tokens !== undefined ? { cacheReadTokens: body.usage.prompt_cache_hit_tokens } : {}),
      } : undefined,
    };
    const choice = body.choices?.[0];
    if (choice?.finish_reason === "content_filter") return { ok: false, ...metadata, reason: "provider_blocked", detail: "content_filter", retryable: false, uncertain: false };
    if (choice?.finish_reason === "length") return { ok: false, ...metadata, reason: "provider_finish_max_tokens", retryable: true, uncertain: false };
    // Strict tools return arguments; still parse legacy JSON content through
    // the same validator if a provider returns it despite the requested mode.
    const call = choice?.message?.tool_calls?.find((c) => c.function?.name === tool.name);
    const text = call?.function?.arguments ?? choice?.message?.content ?? "";
    if (!text.trim()) return { ok: false, ...metadata, reason: "provider_empty_response", retryable: true, uncertain: false };
    let value: unknown;
    try {
      value = restoreOptionalText(unwrapArguments(JSON.parse(stripFence(text))), optionalFields);
    } catch (err) {
      const message = err instanceof SyntaxError ? err.message : "";
      const detail = /control character/i.test(message) ? "tool_arguments_unescaped_control_character"
        : /unterminated|unexpected end/i.test(message) ? "tool_arguments_incomplete_json" : "tool_arguments_invalid_json";
      return { ok: false, ...metadata, reason: "provider_invalid_json", detail, retryable: true, uncertain: false };
    }
    return {
      ok: true,
      value,
      ...metadata,
    };
  }
}
