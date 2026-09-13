import { randomInt } from "node:crypto";

/**
 * Uniform Fisher–Yates shuffle using Node's cryptographically secure,
 * rejection-sampled `randomInt` — every permutation is equally likely
 * (PLAN.md section 4/6). Does not mutate the input.
 */
export function cryptoShuffle<T>(items: readonly T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
