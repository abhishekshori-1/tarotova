import { describe, expect, it } from "vitest";
import { pickReflection } from "./reflections";
import { FOCUSES } from "./types";

describe("pickReflection", () => {
  it("is deterministic for the same focus and seed (a locked reading's prompt never changes on refresh)", () => {
    for (const focus of FOCUSES) {
      const a = pickReflection(focus, "reading-abc");
      const b = pickReflection(focus, "reading-abc");
      expect(a).toBe(b);
    }
  });

  it("can differ across seeds", () => {
    const results = new Set(Array.from({ length: 30 }, (_, i) => pickReflection("general", `reading-${i}`)));
    expect(results.size).toBeGreaterThan(1);
  });
});
