import type { SafetyCategory } from "@/content/safety";
import { POSITION_LABEL } from "./prompts";
import type { ConversationContext, FollowupInput, GenerationProvider, InterpretationInput, ProviderOutcome } from "./types";

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

  // Offline wiring only; this stub never establishes semantic review quality.
  async review(): Promise<ProviderOutcome<unknown>> {
    return { ok: true, model: "stub-reviewer", value: { decision: "pass", issues: [] } };
  }

  async repair(): Promise<ProviderOutcome<unknown>> {
    return { ok: false, reason: "stub_repair_unconfigured", retryable: false, uncertain: false };
  }

  async classify(question: string, _options?: unknown, context?: ConversationContext): Promise<ProviderOutcome<SafetyCategory>> {
    // Offline heuristic, shaped like the real rule: medical and legal are
    // requests for instruction, not mentions. A pronoun request ("should I
    // stop taking it?") is read with the earlier messages, so a follow-up
    // routes the way the real classifier should.
    const latest = question.toLowerCase();
    const earlier = [...(context?.priorUserMessages ?? []), context?.originalQuestion ?? ""].join(" \n ").toLowerCase();
    const asksForInstruction = /\b(should i|can i|is it (safe|ok|normal)|what (dose|should i file)|is this)\b/.test(latest);
    const medical = /\b(medication|antidepressants|surgery|diagnos|lump|taking)\b/;
    const legal = /\b(custody|evict|sue|lawsuit|settlement|my rights)\b/;
    let category: SafetyCategory = "none";
    if (/\b(kill myself|end it all|don't want to be here|better off without me|hurting myself)\b/.test(latest)) category = "crisis";
    else if (asksForInstruction && (medical.test(latest) || medical.test(earlier))) category = "medical";
    else if (asksForInstruction && (legal.test(latest) || legal.test(earlier))) category = "legal";
    else if (/\b(hits me|hit me|controls the money|get back at|make .* suffer)\b/.test(latest)) category = "abuse";
    else if (/\b(breakup|laid off|grief|divorce|feeling low|ill|antidepressants|medication)\b/.test(latest)) category = "stressful";
    return { ok: true, value: category, model: "stub-classifier" };
  }

  async reviewFollowup(): Promise<ProviderOutcome<unknown>> {
    return { ok: true, model: "stub-reviewer", value: { decision: "pass", issues: [] } };
  }

  async repairFollowup(): Promise<ProviderOutcome<unknown>> {
    return { ok: false, reason: "stub_repair_unconfigured", retryable: false, uncertain: false };
  }

  async followup(input: FollowupInput): Promise<ProviderOutcome<unknown>> {
    const q = input.latest;
    if (q.includes("[stub:fail]")) return { ok: false, reason: "provider_http_529", retryable: true, uncertain: false };
    if (q.includes("[stub:uncertain]")) return { ok: false, reason: "provider_timeout", retryable: true, uncertain: true };
    if (q.includes("[stub:slow]")) await new Promise((r) => setTimeout(r, 300));
    const card = input.cards[input.priorTurns.length % input.cards.length];
    const foreign = q.includes("[stub:invalid]") ? " The Tower, The Star and The Fool also come to mind." : "";
    return {
      ok: true,
      model: "stub-followup",
      value: {
        paragraphs: [
          `On that, ${card.name} is the card to look at. ${card.positionText.split(". ")[0]}. Held against what you just asked, that is the part with some give in it.` + foreign,
          `This is turn ${input.priorTurns.length + 1} of the conversation about ${input.originalQuestion ? "your question" : "a reading with no question"}, and nothing here is a forecast.`,
        ],
        reflection: /\b(what should i do|what can i do)\b/i.test(q) ? "One small step you could take this week, and only if you want to: name the thing out loud to someone you trust." : "What would you want to be true here, and what do you already know about it?",
        beyondSpread: /\b(will (i|he|she|they)|when will|does (he|she) )/i.test(q) ? "Three cards can't tell you what happens or what someone else is thinking. They can only show your side of the table." : null,
      },
    };
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
          `Here's the short of it for what you asked. ${names[0]} says you're already moving. ${names[1]} is the thing in the way, and you know its name. ${names[2]} is the way through, and it's slower than you'd like.` +
          foreign,
        cards: input.cards.map((c) => ({
          position: c.position,
          relevance: `${c.name}, ${POSITION_LABEL[c.position].toLowerCase()}. ${c.positionText.split(". ")[0]}. Against what you asked, this is the part that's yours to move.`,
        })),
        reflection: "Do the small version of the next step this week. Then notice what it told you.",
        beyondSpread: /\b(will i|when will|does he|does she|dates?)\b/i.test(q)
          ? "Three cards can't tell you what happens or what someone else is thinking. They can only show your side of the table."
          : null,
      },
    };
  }
}
