import { describe, expect, it } from "vitest";
import { sessionNeedsRenewal, SESSION_TTL_MS } from "@/server/session";

const DAY = 24 * 60 * 60 * 1000;

describe("sessionNeedsRenewal", () => {
  it("does not touch a session set less than a day ago", () => {
    const now = Date.now();
    expect(sessionNeedsRenewal(now + SESSION_TTL_MS, now)).toBe(false);
    expect(sessionNeedsRenewal(now + SESSION_TTL_MS - DAY + 1000, now)).toBe(false);
  });

  it("slides a session that has seen a day or more of age", () => {
    const now = Date.now();
    expect(sessionNeedsRenewal(now + SESSION_TTL_MS - DAY - 1000, now)).toBe(true);
    expect(sessionNeedsRenewal(now + DAY, now)).toBe(true);
  });
});
