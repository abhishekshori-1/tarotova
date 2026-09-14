import type { CardContent, Focus } from "./types";
import { FOCUS_META } from "./focuses";

/**
 * Rule-based combined overview (PLAN.md section 4: "connects the three
 * cards through editorial themes without guaranteeing predictions").
 * Deterministic given the three cards and focus: no randomness, no
 * per-reading generation cost. Shown for readings without a question, and
 * for question readings after triage while the generated answer is pending
 * or has failed. One plain paragraph in the library's stance: each card is
 * named by its position, its theme is stated, and nothing is asserted about
 * the reader's situation or what will happen.
 */
export function buildOverview(situation: CardContent, challenge: CardContent, guidance: CardContent, focus: Focus): string {
  const lens = focus === "general" ? "" : ` You asked about ${FOCUS_META[focus].label.toLowerCase()}, so read the three with that in mind.`;
  return (
    `${situation.name} is in the situation position. ${situation.coreMeaning} ` +
    `${challenge.name} is in the challenge position, where a card speaks to what can be hard. ${challenge.coreMeaning} ` +
    `${guidance.name} is in the guidance position. ${guidance.coreMeaning}` +
    `${lens} Three themes, side by side. None of this is a forecast. Take what fits and leave the rest.`
  );
}
