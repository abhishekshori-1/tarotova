import { describe, expect, it, vi } from "vitest";
import { FallbackProvider } from "./fallback";
import type { GenerationProvider, InterpretationInput, ProviderOutcome } from "./types";

const INPUT = { question: "q", safetyCategory: "none", focusLabel: "General", cards: [] } as InterpretationInput;

function fake(name: string, outcome: ProviderOutcome<unknown>): GenerationProvider & { interpret: ReturnType<typeof vi.fn>; classify: ReturnType<typeof vi.fn> } {
  return { name, interpret: vi.fn().mockResolvedValue(outcome), classify: vi.fn().mockResolvedValue(outcome), review: vi.fn().mockResolvedValue(outcome), repair: vi.fn().mockResolvedValue(outcome) , followup: vi.fn().mockResolvedValue(outcome), reviewFollowup: vi.fn().mockResolvedValue(outcome), repairFollowup: vi.fn().mockResolvedValue(outcome) };
}

const ok = (model: string): ProviderOutcome<unknown> => ({ ok: true, value: { model }, model });
const fail = (reason: string, retryable = true, uncertain = false, detail?: string): Extract<ProviderOutcome<unknown>, { ok: false }> => ({ ok: false, reason, retryable, uncertain, detail });

describe("FallbackProvider", () => {
  it("uses the preferred provider alone when it succeeds", async () => {
    const gemini = fake("gemini", ok("gemini-2.5-pro"));
    const anthropic = fake("anthropic", ok("claude-sonnet-5"));
    const onFallback = vi.fn();
    const chain = new FallbackProvider([gemini, anthropic], onFallback);
    expect(chain.name).toBe("gemini>anthropic");
    expect(await chain.interpret(INPUT)).toMatchObject({ ok: true, model: "gemini-2.5-pro" });
    expect(anthropic.interpret).not.toHaveBeenCalled();
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("falls back on a provider configuration error and reports the switch", async () => {
    const gemini = fake("gemini", fail("provider_http_400", false, false, "INVALID_ARGUMENT: bad key"));
    const anthropic = fake("anthropic", ok("claude-sonnet-5"));
    const onFallback = vi.fn();
    const chain = new FallbackProvider([gemini, anthropic], onFallback);
    expect(await chain.classify("hello")).toMatchObject({ ok: true, model: "claude-sonnet-5" });
    expect(onFallback).toHaveBeenCalledWith("gemini", "anthropic", "provider_http_400", "INVALID_ARGUMENT: bad key");
  });

  it.each(["provider_blocked", "provider_finish_safety", "provider_refused"])("does not send refused content to another provider: %s", async (reason) => {
    const preferred = fake("first", fail(reason, false));
    const next = fake("next", ok("next-model"));
    const chain = new FallbackProvider([preferred, next]);
    expect(await chain.classify("question")).toMatchObject({ ok: false, reason, retryable: false });
    expect(await chain.interpret(INPUT)).toMatchObject({ ok: false, reason, retryable: false });
    expect(next.classify).not.toHaveBeenCalled();
    expect(next.interpret).not.toHaveBeenCalled();
  });

  it("lists every failure when the whole chain fails and keeps the worst flags", async () => {
    const gemini = fake("gemini", fail("provider_timeout", true, true));
    const anthropic = fake("anthropic", fail("provider_http_401", false));
    const chain = new FallbackProvider([gemini, anthropic]);
    expect(await chain.interpret(INPUT)).toMatchObject({
      ok: false,
      reason: "provider_http_401",
      detail: "gemini: provider_timeout; anthropic: provider_http_401",
      retryable: true,
      uncertain: true,
    });
  });
});

it("preserves each billed fallback attempt and the winner separately", async () => {
  const first = fake("deepseek", { ...fail("provider_invalid_json"), model: "deepseek-flash", usage: { inputTokens: 70, outputTokens: 12 }, detail: "tool_arguments_invalid_json" });
  const second = fake("gemini", { ...ok("gemini-3.8-flash"), usage: { inputTokens: 80, outputTokens: 15 } });
  const result = await new FallbackProvider([first, second]).interpret(INPUT);
  expect(result.calls).toEqual([
    expect.objectContaining({ provider: "deepseek", model: "deepseek-flash", reason: "provider_invalid_json", detail: "tool_arguments_invalid_json", ms: expect.any(Number), usage: { inputTokens: 70, outputTokens: 12 } }),
    expect.objectContaining({ provider: "gemini", model: "gemini-3.8-flash", ms: expect.any(Number), usage: { inputTokens: 80, outputTokens: 15 } }),
  ]);
});

it("retains attempted calls when the shared deadline prevents fallback", async () => {
  const first = fake("deepseek", fail("provider_timeout"));
  const second = fake("gemini", ok("gemini-3.8-flash"));
  const options = { deadlineAt: Date.now() + 10_000 };
  first.interpret.mockImplementation(async () => { options.deadlineAt = 0; return fail("provider_timeout"); });
  const result = await new FallbackProvider([first, second]).interpret(INPUT, options);
  expect(result).toMatchObject({ ok: false, reason: "request_deadline", calls: [{ provider: "deepseek", reason: "provider_timeout" }] });
  expect(second.interpret).not.toHaveBeenCalled();
});
