import type { Focus } from "./types";

const REFLECTIONS: Record<Focus, string[]> = {
  general: [
    "What would it look like to act on this today, even in a small way?",
    "What's one thing you already know, underneath the noise?",
    "If this reading is right, what changes first?",
  ],
  relationships: [
    "What's one thing you haven't said out loud yet?",
    "What would this look like from their side of it?",
    "What do you actually need here, separate from what you've been asking for?",
  ],
  work: [
    "What's the smallest next step you've been avoiding?",
    "What would you do differently if you trusted your own judgment on this?",
    "What's actually within your control here, versus what isn't?",
  ],
  growth: [
    "What pattern are you ready to look at honestly?",
    "What would it cost you to keep things exactly as they are?",
    "What's one small, concrete way to practice this over the next week?",
  ],
};

/** Deterministic pick so a locked reading's reflection prompt never changes on refresh. */
export function pickReflection(focus: Focus, seed: string): string {
  const pool = REFLECTIONS[focus];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}
