import { FOCUS_META } from "@/content/focuses";
import type { ResultSnapshot } from "../readingService";
import type { InterpretationInput } from "./types";

/** Shared by production and eval. Never mix a frozen draw with today's deck. */
export function buildInterpretationInput(
  question: string,
  snapshot: Pick<ResultSnapshot, "focus" | "cards">,
  safetyCategory: InterpretationInput["safetyCategory"],
): InterpretationInput {
  return {
    question,
    safetyCategory,
    focusLabel: FOCUS_META[snapshot.focus].label,
    cards: snapshot.cards.map((c) => ({
      position: c.position,
      name: c.name,
      keywords: c.keywords,
      // Older snapshots lack this field. Their frozen position text and
      // focus note remain usable without borrowing a newer core meaning.
      coreMeaning: c.coreMeaning ?? "",
      positionText: c.interpretation,
      focusNote: c.focusNote,
    })),
  };
}
