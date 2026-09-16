import type { Focus } from "./types";

/**
 * Authored follow-up suggestions (docs/RELEASE-C.md section 2): a suggestion
 * fills the text field, the person sends it. No model call chooses them.
 * Written as questions a person might actually ask, in the reader's voice.
 */
export const FOLLOWUP_SUGGESTIONS: Record<Focus, string[]> = {
  general: ["How do these three cards connect?", "What can I act on this week?", "Which card should I pay most attention to?"],
  relationships: ["How do these cards connect?", "What is mine to do here, and what isn't?", "What might the challenge card mean for us?"],
  work: ["How do these cards connect?", "What can I act on this week?", "What am I not seeing about the challenge?"],
  growth: ["How do these cards connect?", "What would understanding this look like, before changing anything?", "Which card describes where I am right now?"],
};

export const FOLLOWUP_COPY = {
  heading: "Explore this reading",
  intro: "Ask about the cards you were dealt. Three follow-ups per reading; a retry uses the same one.",
  remaining: (n: number) => (n === 1 ? "1 follow-up left" : `${n} follow-ups left`),
  placeholder: "Ask about this reading…",
  send: "Send",
  pending: "Thinking about that…",
  failed: "Couldn't answer that one. The reading above stands.",
  retry: "Try that once more",
  ended: "That's the three. The reading stays here for 30 days.",
  closed: "We'll leave the cards there for this one.",
} as const;
