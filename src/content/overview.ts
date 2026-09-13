import type { CardContent, Focus } from "./types";
import { FOCUS_META } from "./focuses";

/**
 * Rule-based combined overview (PLAN.md section 4: "connects the three
 * cards through editorial themes without guaranteeing predictions").
 * Deterministic given the three cards and focus — no randomness, no
 * per-reading generation cost.
 */
export function buildOverview(situation: CardContent, challenge: CardContent, guidance: CardContent, focus: Focus): string {
  const focusLabel = FOCUS_META[focus].label.toLowerCase();
  return (
    `Your situation carries the character of ${situation.name} — ${situation.coreMeaning.toLowerCase()} ` +
    `The tension running through it is ${challenge.name}: ${challenge.coreMeaning.toLowerCase()} ` +
    `The guidance on offer is ${guidance.name}, which points toward ${guidance.keywords[0]} rather than a quick fix. ` +
    `Read together, for a ${focusLabel} reading, these three cards suggest a direction worth weighing — not a prediction, ` +
    `and not a substitute for your own judgment about what's actually in front of you.`
  );
}
