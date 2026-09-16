import type { Focus } from "../types";

export type JourneyStage = "frame" | "explore" | "reflect" | "complete";
export interface JourneyTemplate {
  slug: string; version: string; title: string; purpose: string; focus: Focus;
  motif: "threshold" | "conversation" | "spark";
  starter: string; clarification: string; explore: string; suggestions: string[];
  reflection: string; completion: string;
  review: { status: "draft" | "reviewed"; reviewedAt: string | null; reviewer: string | null };
}

/** Frozen into each run. Editorial approval is a release gate, never invented by code; the owner approved the v1 copy of all three on 17 September 2026 (docs/RELEASE-C-READINESS.md). */
export const JOURNEYS: JourneyTemplate[] = [
  {
    slug: "navigating-change", version: "journeys.v1", title: "Navigating a change", focus: "general", motif: "threshold",
    purpose: "Make room for what is changing, what matters, and what you would like to understand next.",
    starter: "What would I like to understand about this change?",
    clarification: "Which part would you like to explore? You can name it in your question, or leave the question open.",
    explore: "Read the three themes beside the change you named. Notice what fits, what does not, and what you would like to explore further.",
    suggestions: ["How do these themes connect to the change I described?", "What is a practical angle I could consider?", "Can we look at this without deciding what to do yet?"],
    reflection: "What feels clearer, and what still needs time or information?",
    completion: "A change does not have to become a tidy story here. You can leave with a question, a possibility, or simply the words you brought.",
    review: { status: "reviewed", reviewedAt: "2026-09-17", reviewer: "product owner" },
  },
  {
    slug: "preparing-conversation", version: "journeys.v1", title: "Preparing for a conversation", focus: "relationships", motif: "conversation",
    purpose: "Explore what you want to express or understand, with space for your own limits.",
    starter: "What would I like to understand before this conversation?",
    clarification: "What would you like to express or understand? You do not need to decide whether to have the conversation.",
    explore: "Use the reading to consider your words and questions. Another person's response remains theirs; having the conversation is not a requirement.",
    suggestions: ["Can you help me find words for what I described?", "What would I like to understand before speaking?", "How might I express a limit without guessing their reaction?"],
    reflection: "What would you like to say or ask, if you choose to have the conversation?",
    completion: "You can keep the words, change them, or leave them here. Finishing this reflection does not commit you to a conversation.",
    review: { status: "reviewed", reviewedAt: "2026-09-17", reviewer: "product owner" },
  },
  {
    slug: "reopening-creativity", version: "journeys.v1", title: "Reopening creativity", focus: "growth", motif: "spark",
    purpose: "Look at your relationship with creative work, without making productivity the point.",
    starter: "What would I like to understand about my creative work?",
    clarification: "Are you seeking understanding, an experiment, or something else? Your question can say so.",
    explore: "Let the themes be ways of looking at your creative work. You do not have to turn an observation into a routine or a plan.",
    suggestions: ["Can we explore this without giving me a routine?", "Which theme offers a different way to look at what I described?", "What small experiment could fit the limits I mentioned?"],
    reflection: "What do you notice now, without needing to turn it into a task?",
    completion: "An observation can be enough to leave with. This journey asks for no finished work, streak, or promise to begin again.",
    review: { status: "reviewed", reviewedAt: "2026-09-17", reviewer: "product owner" },
  },
];
export function journeyTemplate(slug: string) { return JOURNEYS.find((j) => j.slug === slug); }
