import type { CardContent, Focus } from "./types";
import { FOCUS_META } from "./focuses";

/**
 * Rule-based combined overview (PLAN.md section 4: "connects the three
 * cards through editorial themes without guaranteeing predictions").
 * Deterministic given the three cards and focus: no randomness, no
 * per-reading generation cost. Shown for readings without a question, and
 * for question readings after triage while the generated answer is pending
 * or has failed. One paragraph of 90–120 words in the library's stance
 * (content.v9): each card is named by its position and its keywords, the
 * positions' roles are connected, and nothing is asserted about the
 * reader's situation or what will happen.
 */
function themes(card: CardContent): string {
  const [a, b, c] = card.keywords;
  return c ? `${a}, ${b} and ${c}` : b ? `${a} and ${b}` : a;
}

export function buildOverview(situation: CardContent, challenge: CardContent, guidance: CardContent, focus: Focus): string {
  const lens = focus === "general" ? "" : ` You asked about ${FOCUS_META[focus].label.toLowerCase()}, so read the three with that in mind.`;
  return (
    `${situation.name} opens the reading in the situation position with ${themes(situation)}: the ground a question stands on. ` +
    `${challenge.name} takes the challenge position, where a card names what can be hard. It brings ${themes(challenge)}, and a challenge describes a difficulty in the theme, not a fault in the person asking. ` +
    `${guidance.name} closes the spread in the guidance position, offering ${themes(guidance)} as a way through rather than an instruction. ` +
    `Read the three in order: what is present, what resists, and what helps.` +
    `${lens} None of this is a forecast. Take what fits and leave the rest.`
  );
}
