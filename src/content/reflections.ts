import type { Focus } from "./types";

const REFLECTIONS: Record<Focus, string[]> = {
  general: [
    "Was there a word or image you want to spend more time with?",
    "What do you know about this that the reading leaves out?",
    "Is there a small step you want to take today, or would some time help?",
  ],
  relationships: [
    "Is there anything you want to say, and would it feel safe to say it?",
    "What have they told you about their experience, and what would you need to ask?",
    "What matters to you in this relationship, and how would you put it into words?",
  ],
  work: [
    "What would make the next work decision easier: information, time, help, or something else?",
    "What would a workable next step ask of you, and are those resources available?",
    "What is within your control at work, and where would you need someone else's agreement or support?",
  ],
  growth: [
    "Is there a pattern you want to understand better, without deciding yet that it needs to change?",
    "What would you like to keep as it is, and what would you like to change?",
    "Is there a small practice you want to try this week, and what would make room for it?",
  ],
};

/** Deterministic pick so a locked reading's reflection prompt never changes on refresh. */
export function pickReflection(focus: Focus, seed: string): string {
  const pool = REFLECTIONS[focus];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}
