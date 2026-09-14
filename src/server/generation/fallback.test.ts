import { describe, expect, it, vi } from "vitest";
import { FallbackProvider } from "./fallback";
import type { GenerationProvider, InterpretationInput, ProviderOutcome } from "./types";

const INPUT = { question: "q", safetyCategory: "none", focusLabel: "General", cards: [] } as InterpretationInput;

function fake(name: string, outcome: ProviderOutcome<unknown>): GenerationProvider & { interpret: ReturnType<typeof vi.fn>; classify: ReturnType<typeof vi.fn> } {
  return { name, interpret: vi.fn().mockResolvedValue(outcome), classify: vi.fn().mockResolvedValue(outcome) };
}

const ok = (model: string): ProviderOutcome<unknown> => ({ ok: true, value: { model }, model });
const fail = (reason: string, retryable = true, uncertain = false, detail?: string): ProviderOutcome<unknown> => ({ ok: false, reason, retryable, uncertain, detail });

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
    expect(await chain.interpret(INPUT)).toEqual({
      ok: false,
      reason: "provider_http_401",
      detail: "gemini: provider_timeout; anthropic: provider_http_401",
      retryable: true,
      uncertain: true,
    });
  });
});
