import type { Focus } from "./types";

// One question each, plain, with some bite and no verdict. The question
// opens something; it does not assume what the reader has been doing.
const REFLECTIONS: Record<Focus, string[]> = {
  general: [
    "What do you know about this that the reading doesn't?",
    "Which line in this reading landed, and why that one?",
    "What is the small version of the next step, and is it one you want?",
  ],
  relationships: [
    "What haven't you said out loud yet, and would it be safe to say it?",
    "What does this look like from their side, as far as you actually know?",
    "What do you need here, as distinct from what you have been asking for?",
  ],
  work: [
    "Is there a next step you have been putting off, and what would make it smaller?",
    "What is yours to move here, and where do you need someone else's yes?",
    "What would you decide with all the information, and how much of it do you already have?",
  ],
  growth: [
    "Which pattern here do you want to understand first, before deciding whether it needs to change?",
    "What does keeping things exactly as they are cost you, and what does it give you?",
    "What is one small practice for this week, and what would have to make room for it?",
  ],
};

/** Deterministic pick so a locked reading's reflection prompt never changes on refresh. */
export function pickReflection(focus: Focus, seed: string): string {
  const pool = REFLECTIONS[focus];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}
