import { describe, expect, it } from "vitest";
import { cryptoShuffle } from "./shuffle";

describe("cryptoShuffle", () => {
  it("returns the same elements, just reordered", () => {
    const input = Array.from({ length: 22 }, (_, i) => i);
    const out = cryptoShuffle(input);
    expect(out).toHaveLength(input.length);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it("does not mutate the input", () => {
    const input = [0, 1, 2, 3, 4];
    const copy = [...input];
    cryptoShuffle(input);
    expect(input).toEqual(copy);
  });

  it("produces different orderings across calls (statistical, not exhaustive)", () => {
    const input = Array.from({ length: 22 }, (_, i) => i);
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(cryptoShuffle(input).join(","));
    }
    // 20 shuffles of 22 items landing on the same permutation twice would be
    // astronomically unlikely if this were truly uniform-random.
    expect(results.size).toBeGreaterThan(1);
  });

  it("every position is reachable by every element over many trials", () => {
    // Weak but meaningful uniformity check: with a biased shuffle (e.g. a
    // partial or off-by-one Fisher–Yates), some positions never receive
    // certain elements. Over enough trials every slot should see variety.
    const input = Array.from({ length: 6 }, (_, i) => i);
    const seenAtSlot0 = new Set<number>();
    for (let i = 0; i < 300; i++) {
      seenAtSlot0.add(cryptoShuffle(input)[0]);
    }
    expect(seenAtSlot0.size).toBe(input.length);
  });
});
