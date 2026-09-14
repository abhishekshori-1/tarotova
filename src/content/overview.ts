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
  const about = focus === "general" ? "" : ` Hold these themes alongside what matters to you about ${FOCUS_META[focus].label.toLowerCase()}.`;
  return (
    `${situation.name} offers a starting point. ${situation.coreMeaning} ` +
    `The challenge card is ${challenge.name}. ${challenge.coreMeaning} What might be difficult about that theme? ` +
    `For guidance, consider ${guidance.name}. ${guidance.coreMeaning}${about} ` +
    `What connects with your experience, and what would you leave aside?`
  );
}
