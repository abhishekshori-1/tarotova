import type { SafetyCategory } from "@/content/safety";
import { POSITION_LABEL } from "./prompts";
import type { GenerationProvider, InterpretationInput, ProviderOutcome } from "./types";

/**
 * Deterministic, free, offline provider for development, unit tests and
 * the browser suite. Never available in production (config.ts). Its
 * classifier is a keyword heuristic — the opposite of what the real one
 * must be — which is fine because nothing about routing quality is proven
 * here; eval/ proves that against the real provider.
 *
 * Markers in the question steer failure paths for tests:
 *   [stub:fail]       retryable provider failure
 *   [stub:uncertain]  timeout-style failure (counts as a spent attempt)
 *   [stub:invalid]    output that fails validation (names another card)
 *   [stub:slow]       resolves after 300 ms, for pending-state tests
 */
export class StubProvider implements GenerationProvider {
  readonly name = "stub";

  async classify(question: string): Promise<ProviderOutcome<SafetyCategory>> {
    const q = question.toLowerCase();
    let category: SafetyCategory = "none";
    if (/\b(kill myself|end it all|don't want to be here|better off without me|hurting myself)\b/.test(q)) category = "crisis";
    else if (/\b(medication|antidepressants|surgery|diagnos|lump)\b/.test(q)) category = "medical";
    else if (/\b(custody|evict|sue|lawsuit|settlement|my rights)\b/.test(q)) category = "legal";
    else if (/\b(hits me|hit me|controls the money|get back at|make .* suffer)\b/.test(q)) category = "abuse";
    else if (/\b(breakup|laid off|grief|divorce|feeling low|ill)\b/.test(q)) category = "stressful";
    return { ok: true, value: category, model: "stub-classifier" };
  }

  async interpret(input: InterpretationInput): Promise<ProviderOutcome<unknown>> {
    const q = input.question;
    if (q.includes("[stub:fail]")) return { ok: false, reason: "provider_http_529", retryable: true, uncertain: false };
    if (q.includes("[stub:uncertain]")) return { ok: false, reason: "provider_timeout", retryable: true, uncertain: true };
    if (q.includes("[stub:slow]")) await new Promise((r) => setTimeout(r, 300));
    const names = input.cards.map((c) => c.name);
    const foreign = q.includes("[stub:invalid]") ? " The Tower, The Star and The Fool also come to mind." : "";
    return {
      ok: true,
      model: "stub-answer",
      value: {
        perspective:
          `Read together for your question, ${names[0]}, ${names[1]} and ${names[2]} describe a situation with real momentum, a tension you can name, and a direction worth weighing rather than a verdict.` +
          foreign,
        cards: input.cards.map((c) => ({
          position: c.position,
          relevance: `${c.name} as ${POSITION_LABEL[c.position]}: ${c.positionText.split(". ")[0]}. Held against what you asked, this is the part of the question that is most in your own hands.`,
        })),
        reflection: "Pick the smallest version of the next step you can take this week, and notice what it tells you.",
        beyondSpread: /\b(will i|when will|does he|does she|dates?)\b/i.test(q)
          ? "Three cards can't say what will happen or what someone else is thinking; they can only show what's worth weighing on your side of it."
          : null,
      },
    };
  }
}
