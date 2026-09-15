import { afterEach, describe, expect, it, vi } from "vitest";
import { DeepSeekProvider } from "./deepseek";
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
  it("forces the tool with thinking disabled and parses the arguments", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, toolReply("deliver_reading", { perspective: "..." })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider().interpret(INPUT)).toEqual({ ok: true, value: { perspective: "..." }, model: "deepseek-flash", usage: { inputTokens: 300, outputTokens: 40 } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string);
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "deliver_reading" } });
    expect(body.tools[0].function.parameters.required).toContain("perspective");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].content).toContain("<question>\nWhat should I consider before changing jobs?\n</question>");
  });

  it("classifies and rejects a category outside the taxonomy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, toolReply("classify_intent", { category: "medical" }))));
    expect(await provider().classify("Should I stop my antidepressants?")).toMatchObject({ ok: true, value: "medical" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, toolReply("classify_intent", { category: "spooky" }))));
    expect(await provider().classify("hello")).toMatchObject({ ok: false, reason: "classifier_invalid_output" });
  });

  it("maps HTTP failures with DeepSeek's message, and a content reply as no tool call", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(400, { error: { type: "invalid_request_error", message: "Thinking mode does not support this tool_choice" } })));
    expect(await provider().interpret(INPUT)).toEqual({ ok: false, reason: "provider_http_400", detail: "invalid_request_error: Thinking mode does not support this tool_choice", retryable: false, uncertain: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(429, { error: { message: "rate limited" } })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_http_429", retryable: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { choices: [{ finish_reason: "stop", message: { content: "Sure!" } }] })));
    expect(await provider().interpret(INPUT)).toMatchObject({ ok: false, reason: "provider_no_tool_call", retryable: true });
  });

  it("treats a timeout as uncertain and honours the shared deadline", async () => {
    const timeout = new Error("aborted");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    expect(await provider().interpret(INPUT)).toEqual({ ok: false, reason: "provider_timeout", retryable: true, uncertain: true });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider().review(INPUT, { perspective: "", cards: [], reflection: "", beyondSpread: null }, { deadlineAt: Date.now() - 1 })).toMatchObject({ ok: false, reason: "request_deadline" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
