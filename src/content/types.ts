export const POSITIONS = ["situation", "challenge", "guidance"] as const;
export const FOCUSES = ["general", "relationships", "work", "growth"] as const;

export type Position = (typeof POSITIONS)[number];
export type Focus = (typeof FOCUSES)[number];

export interface CardContent {
  id: string;
  number: number; // RWS Major Arcana numbering, Fool = 0
  name: string;
  numeral: string;
  keywords: string[];
  coreMeaning: string;
  /** The RWS image and its symbolism, 80–110 words, in the library's stance (content.v9). */
  exploration: string;
  position: Record<Position, string>;
  focus: Record<Focus, string>;
}
