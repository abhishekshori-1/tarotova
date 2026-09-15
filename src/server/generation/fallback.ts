import type { SafetyCategory } from "@/content/safety";
import type { ConversationContext, FollowupInput, FollowupOutput, GenerationProvider, GroundingIssue, InterpretationInput, InterpretationOutput, ProviderCallOptions, ProviderOutcome } from "./types";
import { callTimeout, deadlineExceeded } from "./deadline";
import { isProviderRefusal } from "./refusal";

/**
 * Tries providers in order and stops at the first success. A failure on
 * the preferred provider may still incur a charge; the fallback gets
 * the same request unless a provider refuses the content. When all fail, the last outcome is
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

  classify(question: string, options?: ProviderCallOptions, context?: ConversationContext): Promise<ProviderOutcome<SafetyCategory>> {
    return this.run((p) => p.classify(question, options, context), options);
  }

  followup(input: FollowupInput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.run((p) => p.followup(input, options), options);
  }

  reviewFollowup(input: FollowupInput, answer: FollowupOutput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.run((p) => p.reviewFollowup(input, answer, options), options);
  }

  repairFollowup(input: FollowupInput, answer: FollowupOutput, issues: GroundingIssue[], options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.run((p) => p.repairFollowup(input, answer, issues, options), options);
  }

  interpret(input: InterpretationInput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.run((p) => p.interpret(input, options), options);
  }

  review(input: InterpretationInput, answer: InterpretationOutput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    // A valid "revise" verdict is a success, never a reason to shop for approval.
    return this.run((p) => p.review(input, answer, options), options);
  }

  repair(input: InterpretationInput, answer: InterpretationOutput, issues: GroundingIssue[], options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>> {
    return this.run((p) => p.repair(input, answer, issues, options), options);
  }

  private async run<T>(call: (p: GenerationProvider) => Promise<ProviderOutcome<T>>, options?: ProviderCallOptions): Promise<ProviderOutcome<T>> {
    const failures: { name: string; outcome: Extract<ProviderOutcome<T>, { ok: false }> }[] = [];
    for (const [i, provider] of this.chain.entries()) {
      if (callTimeout(Infinity, options) <= 0) return { ...deadlineExceeded(), uncertain: failures.some((f) => f.outcome.uncertain) };
      const outcome = await call(provider);
      if (outcome.ok) return outcome;
      if (isProviderRefusal(outcome.reason)) return { ...outcome, retryable: false, uncertain: outcome.uncertain || failures.some((f) => f.outcome.uncertain) };
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
