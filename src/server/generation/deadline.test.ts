import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "./gemini";
import { AnthropicProvider } from "./anthropic";
import { FallbackProvider } from "./fallback";
import type { InterpretationInput } from "./types";

const input: InterpretationInput = { question: "What now?", focusLabel: "General", safetyCategory: "none", cards: [] };
const models = { answer: "answer", classifier: "classifier" };
const providers = () => [new GeminiProvider("test", models, 30_000), new AnthropicProvider("test", models, 30_000)];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("one deadline across triage, answer and fallback", () => {
  it("bounds all four calls by the same remaining request time", async () => {
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => new AbortController().signal);
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => { now += 30_000; throw new DOMException("timeout", "TimeoutError"); })
      .mockImplementationOnce(async () => {
        now += 5000;
        return new Response(JSON.stringify({ content: [{ type: "tool_use", name: "classify_intent", input: { category: "none" } }] }));
      })
      .mockImplementationOnce(async () => { now += 10_000; return new Response("{}", { status: 503 }); })
      .mockImplementationOnce(async () => { now += 10_000; throw new DOMException("timeout", "TimeoutError"); });
    vi.stubGlobal("fetch", fetchMock);
    const chain = new FallbackProvider(providers());
    const options = { deadlineAt: now + 55_000 };
    expect(await chain.classify(input.question, options)).toMatchObject({ ok: true, value: "none" });
    expect(await chain.interpret(input, options)).toMatchObject({ ok: false, uncertain: true });
    expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([30_000, 25_000, 20_000, 10_000]);
    expect(now).toBe(options.deadlineAt);
    expect(await chain.interpret(input, options)).toMatchObject({ ok: false, reason: "request_deadline", uncertain: false });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not begin fallback after the preferred call uses the remaining time", async () => {
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => new AbortController().signal);
    const fetchMock = vi.fn().mockImplementation(async () => { now += 4000; throw new DOMException("timeout", "TimeoutError"); });
    vi.stubGlobal("fetch", fetchMock);
    expect(await new FallbackProvider(providers()).interpret(input, { deadlineAt: now + 4000 })).toMatchObject({ ok: false, reason: "request_deadline", uncertain: true });
    expect(timeout).toHaveBeenCalledWith(4000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("single providers also refuse to send after the deadline", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const provider of providers()) {
      expect(await provider.classify("question", { deadlineAt: Date.now() - 1 })).toMatchObject({ ok: false, reason: "request_deadline", uncertain: false });
      expect(await provider.interpret(input, { deadlineAt: Date.now() - 1 })).toMatchObject({ ok: false, reason: "request_deadline", uncertain: false });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats an abort while reading the body as a spent timeout", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    } }));
    for (const provider of providers()) {
      expect(await provider.interpret(input, { deadlineAt: Date.now() + 1000 })).toMatchObject({ ok: false, reason: "provider_timeout", uncertain: true });
    }
  });
});
