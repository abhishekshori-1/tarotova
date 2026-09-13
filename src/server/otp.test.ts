import { describe, expect, it } from "vitest";
import { generateCode, hashCode, verifyCodeDigest, type OtpContext } from "./otp";

const ctx: OtpContext = {
  purpose: "reading",
  subjectId: "reading-1",
  challengeId: "challenge-1",
  generation: 1,
  intendedEmail: "person@example.com",
};

describe("generateCode", () => {
  it("always returns a 6-digit string, preserving leading zeros", () => {
    // Run many times since the code space includes values like 000042.
    for (let i = 0; i < 500; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashCode / verifyCodeDigest", () => {
  const secret = "unit-test-secret";

  it("is deterministic for the same code and context", () => {
    const a = hashCode("123456", ctx, secret);
    const b = hashCode("123456", ctx, secret);
    expect(a).toBe(b);
  });

  it("verifies a matching digest", () => {
    const digest = hashCode("123456", ctx, secret);
    expect(verifyCodeDigest(hashCode("123456", ctx, secret), digest)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const digest = hashCode("123456", ctx, secret);
    expect(verifyCodeDigest(hashCode("654321", ctx, secret), digest)).toBe(false);
  });

  it("binds the digest to the subject — same code, different reading, different digest", () => {
    const a = hashCode("123456", ctx, secret);
    const b = hashCode("123456", { ...ctx, subjectId: "reading-2" }, secret);
    expect(a).not.toBe(b);
  });

  it("binds the digest to its purpose — a reading code cannot verify a session, even for the same ids", () => {
    const a = hashCode("123456", ctx, secret);
    const b = hashCode("123456", { ...ctx, purpose: "session_continuation" }, secret);
    expect(a).not.toBe(b);
  });

  it("binds the digest to challengeId", () => {
    const a = hashCode("123456", ctx, secret);
    const b = hashCode("123456", { ...ctx, challengeId: "challenge-2" }, secret);
    expect(a).not.toBe(b);
  });

  it("binds the digest to generation — a resend can't reuse the prior digest", () => {
    const a = hashCode("123456", ctx, secret);
    const b = hashCode("123456", { ...ctx, generation: 2 }, secret);
    expect(a).not.toBe(b);
  });

  it("binds the digest to intendedEmail, case-insensitively normalized", () => {
    const a = hashCode("123456", ctx, secret);
    const bLower = hashCode("123456", { ...ctx, intendedEmail: "PERSON@example.com" }, secret);
    const cDifferent = hashCode("123456", { ...ctx, intendedEmail: "someone-else@example.com" }, secret);
    expect(bLower).toBe(a);
    expect(cDifferent).not.toBe(a);
  });

  it("changes the digest under a different secret (key rotation)", () => {
    const a = hashCode("123456", ctx, secret);
    const b = hashCode("123456", ctx, "a-different-secret");
    expect(a).not.toBe(b);
  });
});
