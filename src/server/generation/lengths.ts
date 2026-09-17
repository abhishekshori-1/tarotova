/**
 * One place for every length the writer, validator, reviewer, repair and
 * eval report agree on (docs/PLAN-READING-EXPERIENCE.md section 4). Tool
 * schemas and prompts read these constants so a limit cannot quietly
 * diverge between what the model is told and what the validator accepts.
 *
 * Character limits are enforced by validation. Word targets are editorial:
 * reported by eval, never a publication gate and never a reason to pad.
 */

/** Initial reading, characters. */
export const READING_LIMITS = {
  perspective: { min: 80, max: 1200 },
  relevance: { min: 40, max: 1800 },
  synthesis: { min: 60, max: 1200 },
  reflection: { min: 20, max: 320 },
  beyondSpread: { min: 1, max: 480 },
  /** All text fields together. */
  total: 7200,
} as const;

/** Follow-up reply, characters. */
export const FOLLOWUP_LENGTHS = {
  paragraphs: { min: 1, max: 5 },
  paragraph: { min: 40, max: 1100 },
  reflection: { min: 20, max: 320 },
  beyondSpread: { min: 1, max: 480 },
  /** Paragraphs, reflection and beyondSpread together. */
  total: 3400,
} as const;

/** Editorial word targets for English answers; the eval reports adherence. */
export const WORD_TARGETS = {
  // 17 September: the owner accepted 500–650 for the whole reading, subject to editorial
  // scoring, after DeepSeek settled near 550 against the plan's 600–750. Sections sum to it.
  reading: {
    whole: { min: 500, max: 650 },
    perspective: { min: 80, max: 95 },
    relevance: { min: 110, max: 125 },
    synthesis: { min: 75, max: 90 },
    reflection: { min: 20, max: 30 },
  },
  followup: {
    substantive: { min: 220, max: 320 },
    practical: { min: 180, max: 280 },
    /** A prayer, thanks or goodbye: one or two sentences. */
    acknowledgment: { min: 8, max: 45 },
    /** A pure instruction attack with no reading question: a brief invitation back. */
    redirection: { min: 8, max: 80 },
  },
} as const;

/** Whitespace-delimited words; an English heuristic only. */
export function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function inRange(count: number, range: { min: number; max: number }): boolean {
  return count >= range.min && count <= range.max;
}
