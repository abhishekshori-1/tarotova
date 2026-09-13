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
  position: Record<Position, string>;
  focus: Record<Focus, string>;
}
