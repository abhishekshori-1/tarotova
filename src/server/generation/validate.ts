import { z } from "zod";
import { CARDS } from "@/content/cards";
import { POSITIONS } from "@/content/types";
import type { FollowupOutput, InterpretationOutput } from "./types";
import { FOLLOWUP_LENGTHS, READING_LIMITS } from "./lengths";

/**
 * The automated gates from eval/RUBRIC.md. Anything that fails here is
 * never stored or shown; the caller decides whether a second paid attempt
 * is worth it. Every limit comes from lengths.ts.
 */
export const LIMITS = { perspective: READING_LIMITS.perspective.max, relevance: READING_LIMITS.relevance.max, synthesis: READING_LIMITS.synthesis.max, reflection: READING_LIMITS.reflection.max, beyondSpread: READING_LIMITS.beyondSpread.max, total: READING_LIMITS.total } as const;
const MINIMUMS = { perspective: READING_LIMITS.perspective.min, relevance: READING_LIMITS.relevance.min, synthesis: READING_LIMITS.synthesis.min, reflection: READING_LIMITS.reflection.min } as const;

// Providers sometimes serialize the absent optional value as the literal
// string "null". Canonicalize only that exact token (and existing empty text)
// before review, never a sentence containing it or a substantive boundary.
const optionalText = (limit: number) => z.string().trim().max(limit).nullable().transform((v) => (!v || v === "null" ? null : v));

const outputSchema = z.strictObject({
  perspective: z.string().trim().min(MINIMUMS.perspective).max(LIMITS.perspective),
  cards: z
    .array(z.strictObject({ position: z.enum(POSITIONS), relevance: z.string().trim().min(MINIMUMS.relevance).max(LIMITS.relevance) }))
    .length(3)
    .refine((cards) => cards.every((c, i) => c.position === POSITIONS[i]), "cards must be in Situation, Challenge, Guidance order"),
  synthesis: z.string().trim().min(MINIMUMS.synthesis).max(LIMITS.synthesis),
  reflection: z.string().trim().min(MINIMUMS.reflection).max(LIMITS.reflection),
  beyondSpread: optionalText(LIMITS.beyondSpread),
});

/**
 * A stored answer, as written by any prompt version. Answers stored before
 * interpretation.v14 have no synthesis; they are read with synthesis null and
 * never regenerated to fit the newer shape (docs/PLAN-READING-EXPERIENCE.md
 * section 4). Nothing here validates; the row was validated when written.
 */
export function normalizeStoredAnswer(raw: unknown): InterpretationOutput {
  const stored = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<InterpretationOutput>;
  return {
    perspective: stored.perspective ?? "",
    cards: stored.cards ?? [],
    synthesis: typeof stored.synthesis === "string" && stored.synthesis.trim() ? stored.synthesis : null,
    reflection: stored.reflection ?? "",
    beyondSpread: stored.beyondSpread ?? null,
  };
}

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
  return answerFields(output).join("\n");
}

function answerFields(output: InterpretationOutput): string[] {
  return [output.perspective, ...output.cards.map((c) => c.relevance), output.synthesis ?? "", output.reflection, output.beyondSpread ?? ""];
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

/** The text gates shared by every generated shape: banned phrasing, asserted certainty, cards not drawn. */
export function checkAnswerText(text: string, drawnCardIds: string[]): { reason: string; detail?: string } | undefined {
  const banned = BANNED_PHRASES.find((p) => p.test(text));
  if (banned) return { reason: "banned_phrase", detail: banned.source };
  const asserted = findAssertedCertainty(text);
  if (asserted) return { reason: "asserted_certainty", detail: asserted };
  const foreign = findForeignCardName(text, drawnCardIds);
  if (foreign) return { reason: "foreign_card", detail: foreign };
  return undefined;
}

export function validateInterpretation(raw: unknown, drawnCardIds: string[]): ValidationResult {
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "output_shape", detail: parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") };
  const output: InterpretationOutput = parsed.data;
  const text = allText(output);
  // Paragraph breaks inside a field count toward its length; only our joining separators are excluded.
  const total = answerFields(output).reduce((sum, field) => sum + field.length, 0);
  if (total > LIMITS.total) return { ok: false, reason: "output_shape", detail: `total ${total} > ${LIMITS.total}` };
  const failed = checkAnswerText(text, drawnCardIds);
  if (failed) return { ok: false, ...failed };
  return { ok: true, output };
}

/** Follow-up turns: one to five paragraphs, an optional question, an optional limit line (docs/RELEASE-C.md section 3; lengths.ts). */
export const FOLLOWUP_LIMITS = { paragraph: FOLLOWUP_LENGTHS.paragraph.max, paragraphs: FOLLOWUP_LENGTHS.paragraphs.max, total: FOLLOWUP_LENGTHS.total, reflection: FOLLOWUP_LENGTHS.reflection.max, beyondSpread: FOLLOWUP_LENGTHS.beyondSpread.max } as const;
const FOLLOWUP_MINIMUMS = { paragraph: FOLLOWUP_LENGTHS.paragraph.min, reflection: FOLLOWUP_LENGTHS.reflection.min } as const;

const followupSchema = z.strictObject({
  paragraphs: z.array(z.string().trim().min(FOLLOWUP_MINIMUMS.paragraph).max(FOLLOWUP_LIMITS.paragraph)).min(FOLLOWUP_LENGTHS.paragraphs.min).max(FOLLOWUP_LIMITS.paragraphs),
  reflection: optionalText(FOLLOWUP_LIMITS.reflection),
  beyondSpread: optionalText(FOLLOWUP_LIMITS.beyondSpread),
});

export type FollowupValidationResult = { ok: true; output: FollowupOutput } | { ok: false; reason: string; detail?: string };

export function validateFollowup(raw: unknown, drawnCardIds: string[]): FollowupValidationResult {
  const parsed = followupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "output_shape", detail: parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") };
  const output: FollowupOutput = parsed.data;
  if (output.reflection !== null && output.reflection.length < FOLLOWUP_MINIMUMS.reflection) return { ok: false, reason: "output_shape", detail: "reflection too short" };
  const total = output.paragraphs.join("\n").length + (output.reflection?.length ?? 0) + (output.beyondSpread?.length ?? 0);
  if (total > FOLLOWUP_LIMITS.total) return { ok: false, reason: "output_shape", detail: `total ${total} > ${FOLLOWUP_LIMITS.total}` };
  const failed = checkAnswerText([...output.paragraphs, output.reflection ?? "", output.beyondSpread ?? ""].join("\n"), drawnCardIds);
  if (failed) return { ok: false, ...failed };
  return { ok: true, output };
}
