import type { CardContent, Focus } from "./types";
import { FOCUS_META } from "./focuses";

/**
 * Rule-based combined overview (PLAN.md section 4: "connects the three
 * cards through editorial themes without guaranteeing predictions").
 * Deterministic given the three cards and focus: no randomness, no
 * per-reading generation cost. Shown for readings without a question; a
 * question reading gets a generated perspective instead. Written as one
 * plain paragraph in the library's stance: themes, not findings, and no
 * forecast.
 */
export function buildOverview(situation: CardContent, challenge: CardContent, guidance: CardContent, focus: Focus): string {
  const lens = focus === "general" ? "" : ` Read them with ${FOCUS_META[focus].label.toLowerCase()} in mind, since that is what you asked about.`;
  return (
    `${situation.name} sets the scene. ${situation.coreMeaning} ` +
    `${challenge.name} names what is hard here. ${challenge.coreMeaning} ` +
    `${guidance.name} is the way through the cards offer. ${guidance.coreMeaning}` +
    `${lens} Three themes, side by side. None of this is a forecast. Take what fits and leave the rest.`
  );
}
