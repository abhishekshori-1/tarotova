import { z } from "zod";
import { CARDS } from "@/content/cards";
import { POSITIONS } from "@/content/types";
import type { InterpretationOutput } from "./types";

/**
 * The automated gates from eval/RUBRIC.md. Anything that fails here is
 * never stored or shown; the caller decides whether a second paid attempt
 * is worth it.
 */
export const LIMITS = { perspective: 900, relevance: 600, reflection: 320, beyondSpread: 480 } as const;
const MINIMUMS = { perspective: 80, relevance: 40, reflection: 20 } as const;

const outputSchema = z.strictObject({
  perspective: z.string().trim().min(MINIMUMS.perspective).max(LIMITS.perspective),
  cards: z
    .array(z.strictObject({ position: z.enum(POSITIONS), relevance: z.string().trim().min(MINIMUMS.relevance).max(LIMITS.relevance) }))
    .length(3)
    .refine((cards) => cards.every((c, i) => c.position === POSITIONS[i]), "cards must be in Situation, Challenge, Guidance order"),
  reflection: z.string().trim().min(MINIMUMS.reflection).max(LIMITS.reflection),
  beyondSpread: z.string().trim().max(LIMITS.beyondSpread).nullable().transform((v) => (v ? v : null)),
});

/** Always rejected, whatever surrounds them. */
export const BANNED_PHRASES: readonly RegExp[] = [
  /\breversed\b/i,
  /\breversal\b/i,
  /\binverted\b/i,
  /\bdefinitely will\b/i,
  /\bwill definitely\b/i,
  /\bwill certainly\b/i,
  /\bis certain to\b/i,
  /\bthe cards predict\b/i,
  /\bpredicts that\b/i,
  /\bit is fate\b/i,
  /\bprescri/i,
  /\bdosage\b/i,
  /\bstop taking\b/i,
  /\byou should sue\b/i,
  /\blegal advice\b/i,
];

/**
 * Certainty is rejected only when asserted, never when denied or merely
 * mentioned. The real runs showed the model using these words almost only
 * in denial ("These cards can't tell you what he thinks, or guarantee how
 * it unfolds"), so the patterns below are the assertive forms, and any
 * negation earlier in the same clause clears the match.
 */
export const CERTAINTY_ASSERTIONS: readonly RegExp[] = [
  /\b(?:is|are|it's|that's|you're|you are|this is|will be)\s+guaranteed\b/i,
  /\bguaranteed to\b/i,
  /\b(?:I|we|the cards|these cards|this reading)\s+(?:can\s+|will\s+|could\s+)?guarantee\b/i,
  /\b(?:I|I'd|I would|we|the cards|these cards|this reading)\s+(?:can\s+|will\s+|could\s+|would\s+)?diagnos\w*/i,
  /\bdiagnosed with\b/i,
  /\b(?:I|we|the cards|these cards|this reading)\s+(?:can\s+|will\s+|could\s+)?predicts?\b/i,
  /\b(?:you|he|she|they)(?:'re| are|'s| is)\s+destined\b/i,
  /\bdestined to\b/i,
];
const NEGATION = /\b(?:no|not|nothing|never|without|nor|neither|isn't|aren't|can't|cannot|couldn't|doesn't|don't|won't|wouldn't|shouldn't|rather than|instead of|beyond|less about)\b/i;

export function findAssertedCertainty(text: string): string | undefined {
  for (const pattern of CERTAINTY_ASSERTIONS) {
    for (const match of text.matchAll(new RegExp(pattern.source, "gi"))) {
      // The clause: back to the previous sentence or semicolon boundary.
      // A denial before a contrast/new sentence cannot excuse an assertion
      // after it ("I can't know, but I guarantee...").
      const clause = text.slice(0, match.index).split(/[.!?;\n]|\b(?:but|however|yet)\b/i).pop() ?? "";
      if (!NEGATION.test(clause)) return match[0];
    }
  }
  return undefined;
}

export type ValidationResult = { ok: true; output: InterpretationOutput } | { ok: false; reason: string; detail?: string };

function allText(output: InterpretationOutput): string {
  return [output.perspective, ...output.cards.map((c) => c.relevance), output.reflection, output.beyondSpread ?? ""].join("\n");
}

/**
 * A name of another deck card appearing in the text. Case-sensitive so the
 * plain words "strength", "justice" or "death" pass; a capitalized match at
 * the start of a sentence is tolerated only for ambiguous single-word
 * names, e.g. "Justice matters". "The Star" is still a card reference.
 */
export function findForeignCardName(text: string, drawnCardIds: string[]): string | undefined {
  for (const card of CARDS) {
    if (drawnCardIds.includes(card.id)) continue;
    const pattern = new RegExp(`(^|[^A-Za-z])${card.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`, "g");
    for (const match of text.matchAll(pattern)) {
      const start = match.index + match[1].length;
      const before = text.slice(0, start).trimEnd();
      const sentenceStart = before === "" || /[.!?:\n"“]$/.test(before);
      if (!sentenceStart || card.name.includes(" ")) return card.name;
    }
  }
  return undefined;
}

export function validateInterpretation(raw: unknown, drawnCardIds: string[]): ValidationResult {
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "output_shape", detail: parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") };
  const output: InterpretationOutput = parsed.data;
  const text = allText(output);

  const banned = BANNED_PHRASES.find((p) => p.test(text));
  if (banned) return { ok: false, reason: "banned_phrase", detail: banned.source };
  const asserted = findAssertedCertainty(text);
  if (asserted) return { ok: false, reason: "asserted_certainty", detail: asserted };

  const foreign = findForeignCardName(text, drawnCardIds);
  if (foreign) return { ok: false, reason: "foreign_card", detail: foreign };

  return { ok: true, output };
}
