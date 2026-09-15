import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider, toGeminiSchema } from "./gemini";
import { READING_TOOL } from "./prompts";
import { INTERPRETATION_SYSTEM } from "./prompts";
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
  return new GeminiProvider("g-test", { answer: "gemini-2.5-pro", classifier: "gemini-2.5-flash" }, 5_000);
}

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function candidate(text: string, extra: Record<string, unknown> = {}) {
  return { candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 150 }, modelVersion: "gemini-2.5-pro-001", ...extra };
}

afterEach(() => vi.unstubAllGlobals());

describe("toGeminiSchema", () => {
  it("drops additionalProperties and turns a null type union into nullable", () => {
    const schema = toGeminiSchema(READING_TOOL.input_schema) as { additionalProperties?: unknown; properties: Record<string, { type?: unknown; nullable?: boolean }>; required: string[] };
    expect(schema.additionalProperties).toBeUndefined();
    expect(schema.properties.beyondSpread).toMatchObject({ type: "string", nullable: true });
    expect(schema.properties.perspective.type).toBe("string");
    expect(schema.required).toEqual(["perspective", "cards", "reflection", "beyondSpread"]);
    const items = (schema.properties.cards as unknown as { items: { additionalProperties?: unknown; properties: { position: { enum: string[] } } } }).items;
    expect(items.additionalProperties).toBeUndefined();
    expect(items.properties.position.enum).toEqual(["situation", "challenge", "guidance"]);
  });
});

describe("GeminiProvider", () => {
  it("asks for JSON against the converted schema and parses the reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, candidate(JSON.stringify({ perspective: "..." }))));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await provider().interpret(INPUT);
    expect(outcome).toEqual({ ok: true, value: { perspective: "..." }, model: "gemini-2.5-pro-001", usage: { inputTokens: 400, outputTokens: 150 } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("g-test");
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe(INTERPRETATION_SYSTEM);
    expect(body.contents[0].parts[0].text).toContain("<question>\nWhat should I consider before changing jobs?\n</question>");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema.properties.beyondSpread.nullable).toBe(true);
  });

  it("classifies through the flash model and rejects a category outside the taxonomy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, candidate(JSON.stringify({ category: "medical" }))));
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider().classify("Should I stop my antidepressants?")).toMatchObject({ ok: true, value: "medical" });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("gemini-2.5-flash:generateContent");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, candidate(JSON.stringify({ category: "spooky" })))));
    expect(await provider().classify("hello")).toMatchObject({ ok: false, reason: "classifier_invalid_output" });
  });

  it("maps HTTP failures, keeping Google's status and message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(429, { error: { status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" } })));
    expect(await provider().interpret(INPUT)).toEqual({ ok: false, reason: "provider_http_429", detail: "RESOURCE_EXHAUSTED: Quota exceeded", retryable: true, uncertain: false });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(400, { error: { status: "INVALID_ARGUMENT", message: "API key not valid" } })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_http_400", retryable: false });
  });

  it("treats a safety block as terminal, a truncated reply as retryable, and a timeout as uncertain", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { promptFeedback: { blockReason: "SAFETY" } })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_blocked", detail: "SAFETY", retryable: false });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { candidates: [{ content: { parts: [{ text: '{"persp' }] }, finishReason: "MAX_TOKENS" }] })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_finish_max_tokens", retryable: true });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, candidate("not json"))));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_invalid_json", retryable: true });

    const timeout = new Error("aborted");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    expect(await provider().interpret(INPUT)).toEqual({ ok: false, reason: "provider_timeout", retryable: true, uncertain: true });
  });
});
