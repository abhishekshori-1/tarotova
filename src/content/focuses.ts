import type { Focus } from "./types";

export const FOCUS_META: Record<Focus, { label: string; description: string }> = {
  general: { label: "General", description: "An open reading, not aimed at one part of life." },
  relationships: { label: "Relationships", description: "Connection, from your own point of view." },
  work: { label: "Work", description: "Career, projects, and how you're spending your effort." },
  growth: { label: "Personal growth", description: "Habits, self-understanding, and change over time." },
};

export const DEFAULT_FOCUS: Focus = "general";
