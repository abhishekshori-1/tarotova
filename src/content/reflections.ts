import type { Focus } from "./types";

const REFLECTIONS: Record<Focus, string[]> = {
  general: [
    "What's the small version of this you could do today?",
    "What do you already know here that you keep talking yourself out of?",
    "If this reading is right, what changes first?",
  ],
  relationships: [
    "What haven't you said out loud yet?",
    "What does this look like from their side of the table?",
    "What do you actually need here, as opposed to what you've been asking for?",
  ],
  work: [
    "What's the next step you've been avoiding, and how small could it be?",
    "What would you do if you trusted your own call on this?",
    "What's actually yours to move here, and what isn't?",
  ],
  growth: [
    "What pattern are you finally ready to look at straight?",
    "What does it cost you to keep things exactly as they are?",
    "What's one small, real way to practice this before next week?",
  ],
};

/** Deterministic pick so a locked reading's reflection prompt never changes on refresh. */
export function pickReflection(focus: Focus, seed: string): string {
  const pool = REFLECTIONS[focus];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}
