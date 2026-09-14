import type { CardContent, Focus } from "./types";
import { FOCUS_META } from "./focuses";

/**
 * Rule-based combined overview (PLAN.md section 4: "connects the three
 * cards through editorial themes without guaranteeing predictions").
 * Deterministic given the three cards and focus — no randomness, no
 * per-reading generation cost. Written in the reader's voice: plain,
 * direct, no forecast.
 */
export function buildOverview(situation: CardContent, challenge: CardContent, guidance: CardContent, focus: Focus): string {
  const about = focus === "general" ? "" : ` You asked about ${FOCUS_META[focus].label.toLowerCase()}, so read it that way.`;
  return (
    `Where you are is ${situation.name}. ${situation.coreMeaning} ` +
    `What's in the way is ${challenge.name}. ${challenge.coreMeaning} ` +
    `The way through is ${guidance.name}, and it asks for ${guidance.keywords[0]}, not a quick fix.${about} ` +
    `That's the shape of it. Not a forecast. What you do with it is still yours.`
  );
}
