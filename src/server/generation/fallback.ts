import type { SafetyCategory } from "@/content/safety";
import type { GenerationProvider, InterpretationInput, ProviderOutcome } from "./types";

/**
 * Tries providers in order and stops at the first success. A failure on
 * the preferred provider costs nothing but time; the fallback then gets
 * the same request. When every provider fails, the last outcome is
 * returned with every reason listed, and `uncertain` is true if any
 * provider timed out after possibly doing the work. One pass through the
 * chain is one attempt for the caller's cap.
 */
export class FallbackProvider implements GenerationProvider {
  readonly name: string;
  constructor(
    private readonly chain: GenerationProvider[],
    private readonly onFallback: (from: string, to: string, reason: string, detail?: string) => void = () => {},
  ) {
    if (chain.length === 0) throw new Error("FallbackProvider needs at least one provider");
    this.name = chain.map((p) => p.name).join(">");
  }

  classify(question: string): Promise<ProviderOutcome<SafetyCategory>> {
    return this.run((p) => p.classify(question));
  }

  interpret(input: InterpretationInput): Promise<ProviderOutcome<unknown>> {
    return this.run((p) => p.interpret(input));
  }

  private async run<T>(call: (p: GenerationProvider) => Promise<ProviderOutcome<T>>): Promise<ProviderOutcome<T>> {
    const failures: { name: string; outcome: Extract<ProviderOutcome<T>, { ok: false }> }[] = [];
    for (const [i, provider] of this.chain.entries()) {
      const outcome = await call(provider);
      if (outcome.ok) return outcome;
      failures.push({ name: provider.name, outcome });
      const next = this.chain[i + 1];
      if (next) this.onFallback(provider.name, next.name, outcome.reason, outcome.detail);
    }
    const last = failures[failures.length - 1].outcome;
    return {
      ok: false,
      reason: last.reason,
      detail: failures.map((f) => `${f.name}: ${f.outcome.reason}${f.outcome.detail ? ` (${f.outcome.detail})` : ""}`).join("; "),
      retryable: failures.some((f) => f.outcome.retryable),
      uncertain: failures.some((f) => f.outcome.uncertain),
    };
  }
}
