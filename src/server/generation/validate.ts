import { z } from "zod";
import { CARDS } from "@/content/cards";
import { POSITIONS } from "@/content/types";
import type { InterpretationOutput } from "./types";

/**
 * The automated gates from eval/RUBRIC.md. Anything that fails here is
 * never stored or shown; the caller decides whether a second paid attempt
 * is worth it.
 */
export const LIMITS = { perspective: 900, relevance: 600, reflection: 320, beyondSpread: 320 } as const;
const MINIMUMS = { perspective: 80, relevance: 40, reflection: 20 } as const;

const outputSchema = z.object({
  perspective: z.string().trim().min(MINIMUMS.perspective).max(LIMITS.perspective),
  cards: z
    .array(z.object({ position: z.enum(POSITIONS), relevance: z.string().trim().min(MINIMUMS.relevance).max(LIMITS.relevance) }))
    .length(3)
    .refine((cards) => cards.every((c, i) => c.position === POSITIONS[i]), "cards must be in Situation, Challenge, Guidance order"),
  reflection: z.string().trim().min(MINIMUMS.reflection).max(LIMITS.reflection),
  beyondSpread: z.string().trim().max(LIMITS.beyondSpread).nullable().transform((v) => (v ? v : null)),
});

export const BANNED_PHRASES: readonly RegExp[] = [
  /\breversed\b/i,
  /\breversal\b/i,
  /\binverted\b/i,
  /\bguarantee[ds]?\b/i,
  /\bdefinitely will\b/i,
  /\bwill definitely\b/i,
  /\bwill certainly\b/i,
  /\bis certain to\b/i,
  /\bthe cards predict\b/i,
  /\bpredicts that\b/i,
  /\bdestined\b/i,
  /\bit is fate\b/i,
  /\bdiagnos/i,
  /\bprescri/i,
  /\bdosage\b/i,
  /\bstop taking\b/i,
  /\byou should sue\b/i,
  /\blegal advice\b/i,
];

export type ValidationResult = { ok: true; output: InterpretationOutput } | { ok: false; reason: string; detail?: string };

function allText(output: InterpretationOutput): string {
  return [output.perspective, ...output.cards.map((c) => c.relevance), output.reflection, output.beyondSpread ?? ""].join("\n");
}

/**
 * A name of another deck card appearing in the text. Case-sensitive so the
 * plain words "strength", "justice" or "death" pass; a capitalized match at
 * the start of a sentence is also tolerated because it is ambiguous.
 */
export function findForeignCardName(text: string, drawnCardIds: string[]): string | undefined {
  for (const card of CARDS) {
    if (drawnCardIds.includes(card.id)) continue;
    const pattern = new RegExp(`(^|[^A-Za-z])${card.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`, "g");
    for (const match of text.matchAll(pattern)) {
      const start = match.index + match[1].length;
      const before = text.slice(0, start).trimEnd();
      const sentenceStart = before === "" || /[.!?:\n"“]$/.test(before);
      if (!sentenceStart) return card.name;
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

  const foreign = findForeignCardName(text, drawnCardIds);
  if (foreign) return { ok: false, reason: "foreign_card", detail: foreign };

  return { ok: true, output };
}
