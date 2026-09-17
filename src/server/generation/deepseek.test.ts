import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalReading, deepseekStrictSchema, DeepSeekProvider, stripFence, unwrapArguments } from "./deepseek";
import { validateInterpretation } from "./validate";
import type { InterpretationInput } from "./types";

const INPUT: InterpretationInput = {
  question: "What should I consider before changing jobs?",
  safetyCategory: "none",
  focusLabel: "Work",
  cards: [
    { position: "situation", name: "The Fool", keywords: ["beginnings"], coreMeaning: "A step into the unknown.", positionText: "You're at the edge.", focusNote: "A new role is on the table." },
    { position: "challenge", name: "The Chariot", keywords: ["direction"], coreMeaning: "Will and direction.", positionText: "Momentum without aim.", focusNote: "Pick a lane." },
    { position: "guidance", name: "The Hermit", keywords: ["reflection"], coreMeaning: "Withdraw to see clearly.", positionText: "Take time.", focusNote: "Think before answering." },
  ],
};

function provider() {
  return new DeepSeekProvider("sk-test", { answer: "deepseek-flash", classifier: "deepseek-flash" }, 5_000);
}
function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function toolReply(name: string, args: unknown, extra: Record<string, unknown> = {}) {
  return { model: "deepseek-flash", choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ function: { name, arguments: JSON.stringify(args) } }] } }], usage: { prompt_tokens: 300, completion_tokens: 40 }, ...extra };
}

afterEach(() => vi.unstubAllGlobals());

describe("DeepSeekProvider", () => {
  it("separates automatically cached tokens from uncached input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, toolReply("deliver_reading", {}, {
      usage: { prompt_tokens: 300, prompt_cache_hit_tokens: 240, prompt_cache_miss_tokens: 60, completion_tokens: 40 },
    })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider().interpret(INPUT)).toMatchObject({ usage: { inputTokens: 60, outputTokens: 40, cacheReadTokens: 240 } });
  });

  it("uses strict tool mode with thinking disabled and parses the arguments", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, toolReply("deliver_reading", { perspective: "..." })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider().interpret(INPUT)).toEqual({ ok: true, value: { perspective: "..." }, model: "deepseek-flash", usage: { inputTokens: 300, outputTokens: 40 } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/beta/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string);
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.response_format).toBeUndefined();
    expect(body.tools[0].function.strict).toBe(true);
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "deliver_reading" } });
    expect(body.messages[0].role).toBe("system");
    expect(body.tools[0].function.parameters.required).toContain("perspective");
    expect(body.messages[1].content).toContain("<question>\nWhat should I consider before changing jobs?\n</question>");
  });

  it("unwraps arguments DeepSeek wraps under a single parameters key, and nothing else", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(200, toolReply("deliver_reading", { parameters: { perspective: "..." } }))).mockResolvedValueOnce(response(200, toolReply("deliver_reading", { parameters: "..." , perspective: "x" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: true, value: { perspective: "..." } });
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: true, value: { parameters: "...", perspective: "x" } });
    expect(unwrapArguments({ arguments: { a: 1 } })).toEqual({ a: 1 });
    expect(unwrapArguments({ paragraphs: ["p"] })).toEqual({ paragraphs: ["p"] });
    expect(unwrapArguments({ parameters: ["not", "an", "object"] })).toEqual({ parameters: ["not", "an", "object"] });
  });

  it("requests each position once and maps fixed keys to the stored order without changing text", async () => {
    const cards = { guidance: "Guidance paragraph.\n\nAnother paragraph.", situation: "Situation text.", challenge: "Challenge text." };
    const fetchMock = vi.fn().mockResolvedValue(response(200, toolReply("deliver_reading", { cards, synthesis: "Connection." })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: true, value: {
      cards: [
        { position: "situation", relevance: cards.situation },
        { position: "challenge", relevance: cards.challenge },
        { position: "guidance", relevance: cards.guidance },
      ], synthesis: "Connection.",
    } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const schema = body.tools[0].function.parameters;
    expect(schema.properties.cards).toBeUndefined();
    expect(schema.required).toEqual(["perspective", "situation", "challenge", "guidance", "synthesis", "reflection", "beyondSpread"]);
    expect(schema.properties.situation.type).toBe("string");
  });

  it("adapts only unsupported schema constraints and keeps nullable fields explicit", () => {
    expect(deepseekStrictSchema({ type: "object", additionalProperties: false, required: ["text", "edits"], properties: {
      text: { type: ["string", "null"], description: "Optional boundary", maxLength: 480 },
      edits: { type: "array", minItems: 1, maxItems: 2, items: { type: "string", enum: ["situation", "guidance"] } },
    } })).toEqual({ type: "object", additionalProperties: false, required: ["text", "edits"], properties: {
      text: { anyOf: [{ type: "string" }, { type: "null" }], description: "Optional boundary" },
      edits: { type: "array", items: { type: "string", enum: ["situation", "guidance"] } },
    } });
  });

  it("requests quoted optional text and restores only the empty sentinel", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, toolReply("deliver_reading", { reflection: "", beyondSpread: "", extra: "" })))
      .mockResolvedValueOnce(response(200, toolReply("answer_followup", { paragraphs: ["A reply."], reflection: "", beyondSpread: "A specific boundary." })))
      .mockResolvedValueOnce(response(200, toolReply("answer_followup", { paragraphs: ["A reply."], reflection: " ", beyondSpread: 42 })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: true, value: { reflection: "", beyondSpread: null, extra: "" } });
    const input = { ...INPUT, originalQuestion: INPUT.question, history: [], latestMessage: "Thanks" } as unknown as Parameters<DeepSeekProvider["followup"]>[0];
    expect(await provider().followup(input)).toMatchObject({ ok: true, value: { reflection: null, beyondSpread: "A specific boundary." } });
    expect(await provider().followup(input)).toMatchObject({ ok: true, value: { reflection: " ", beyondSpread: 42 } });
    const reading = JSON.parse(fetchMock.mock.calls[0][1].body).tools[0].function.parameters;
    const followup = JSON.parse(fetchMock.mock.calls[1][1].body).tools[0].function.parameters;
    expect(reading.properties.beyondSpread.type).toBe("string");
    expect(reading.properties.beyondSpread.anyOf).toBeUndefined();
    expect(followup.properties.reflection.type).toBe("string");
  });

  it("rejects the captured unquoted boundary instead of guessing its JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, {
      choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ function: {
        name: "deliver_reading", arguments: '{"beyondSpread": The cards cannot tell you that.}',
      } }] } }], usage: { prompt_tokens: 100, completion_tokens: 30 },
    })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_invalid_json", usage: { inputTokens: 100, outputTokens: 30 } });
  });

  it("leaves missing, extra, and non-text positions invalid rather than completing a reading", () => {
    const base = {
      perspective: "A starting point for considering the question through three different themes, without deciding which fits.",
      synthesis: "These themes can be considered separately before deciding whether any connection fits the question.",
      reflection: "Which of these themes, if any, seems relevant to the question?",
      beyondSpread: null,
    };
    const text = "A theme to consider beside the question, without treating it as a fact about the person.";
    const flat = { ...base, situation: text, challenge: text, guidance: text };
    expect(validateInterpretation(canonicalReading(flat), []).ok).toBe(true);
    for (const invalid of [
      { ...flat, guidance: undefined },
      { ...flat, guidance: [text] },
      { ...flat, note: "extra" },
      { ...flat, cards: [] },
    ]) {
      expect(canonicalReading(invalid)).toBe(invalid);
      expect(validateInterpretation(canonicalReading(invalid), []).ok).toBe(false);
    }
    expect(validateInterpretation(canonicalReading({ ...base, cards: { situation: text, challenge: text, guidance: text } }), []).ok).toBe(true);
    for (const cards of [
      { situation: "S", challenge: "C" },
      { situation: "S", challenge: "C", guidance: "G", summary: "extra" },
      { situation: "S", challenge: "C", guidance: ["G"] },
    ]) {
      const raw = { ...base, cards };
      expect(canonicalReading(raw)).toBe(raw);
      expect(validateInterpretation(canonicalReading(raw), []).ok).toBe(false);
    }
    const wrongOrder = { cards: [{ position: "guidance", relevance: "G" }, { position: "situation", relevance: "S" }] };
    expect(canonicalReading(wrongOrder)).toBe(wrongOrder);
  });

  it("classifies and rejects a category outside the taxonomy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, toolReply("classify_intent", { category: "medical" }))));
    expect(await provider().classify("Should I stop my antidepressants?")).toMatchObject({ ok: true, value: "medical" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, toolReply("classify_intent", { category: "spooky" }))));
    expect(await provider().classify("hello")).toMatchObject({ ok: false, reason: "classifier_invalid_output" });
  });

  it("still accepts a tool call, and a fenced JSON block", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { model: "deepseek-flash", choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ function: { name: "deliver_reading", arguments: JSON.stringify({ perspective: "tool" }) } }] } }] })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: true, value: { perspective: "tool" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { choices: [{ finish_reason: "stop", message: { content: "```json\n{\"perspective\":\"fenced\"}\n```" } }] })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: true, value: { perspective: "fenced" } });
    expect(stripFence("{\"a\":1}")).toBe("{\"a\":1}");
  });

  it("maps HTTP failures with DeepSeek's message, and prose or nothing as an empty or invalid response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(400, { error: { type: "invalid_request_error", message: "Thinking mode does not support this tool_choice" } })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_http_400", detail: "invalid_request_error: Thinking mode does not support this tool_choice", retryable: false, uncertain: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(429, { error: { message: "rate limited" } })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_http_429", retryable: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { choices: [{ finish_reason: "stop", message: { content: "Sure!" } }] })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_invalid_json", retryable: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { choices: [{ finish_reason: "stop", message: { content: "" } }] })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_empty_response", retryable: true });
  });

  it("treats a timeout as uncertain and honours the shared deadline", async () => {
    const timeout = new Error("aborted");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_timeout", retryable: true, uncertain: true });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider().review(INPUT, { perspective: "", cards: [], synthesis: null, reflection: "", beyondSpread: null }, { deadlineAt: Date.now() - 1 })).toMatchObject({ ok: false, reason: "request_deadline" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

it("keeps billed usage when malformed JSON triggers a fallback", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, {
    model: "deepseek-flash", choices: [{ finish_reason: "stop", message: { content: '{"perspective":' } }],
    usage: { prompt_tokens: 300, prompt_cache_hit_tokens: 240, prompt_cache_miss_tokens: 60, completion_tokens: 40 },
  })));
  expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, model: "deepseek-flash", reason: "provider_invalid_json", detail: expect.stringMatching(/^tool_arguments_(invalid|incomplete)_json$/), usage: { inputTokens: 60, outputTokens: 40, cacheReadTokens: 240 } });
});
