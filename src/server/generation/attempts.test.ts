import { describe, expect, it, vi } from "vitest";
import { mayAttempt, runAttempts, type AttemptPolicy } from "./attempts";
import type { ReviewedOutcome } from "./reviewed";

const policy: AttemptPolicy = { maxAttempts: 2, deadlineAt: 1_000_000, requestStartedAt: 0, budgetMs: 25_000 };
const live = (): AttemptPolicy => ({ maxAttempts: 2, deadlineAt: Date.now() + 60_000, requestStartedAt: Date.now(), budgetMs: 25_000 });
const trace = { repairAttempted: false, calls: [], reviews: [] };
const ok = (): ReviewedOutcome<string> => ({ ok: true, value: "answer", model: "m", quality: trace });
const fail = (reason: string, retryable: boolean): ReviewedOutcome<string> => ({ ok: false, reason, retryable, uncertain: false, quality: trace });

describe("shared attempt policy", () => {
  it("allows a first attempt until the deadline, and a further one only inside the request budget", () => {
    expect(mayAttempt(0, 0, policy, 30_000)).toBe(true); // first attempt of the request, budget irrelevant
    expect(mayAttempt(1, 0, policy, 24_999)).toBe(true);
    expect(mayAttempt(1, 0, policy, 25_000)).toBe(false); // request budget spent
    expect(mayAttempt(1, 1, policy, 30_000)).toBe(true); // a retry request: its first attempt
    expect(mayAttempt(2, 0, policy, 10)).toBe(false); // attempts exhausted
    expect(mayAttempt(0, 0, policy, 1_000_000)).toBe(false); // deadline
  });

  it("retries a retryable outcome once, and treats a grounding rejection as terminal", async () => {
    const invalidThenOk = vi.fn().mockResolvedValueOnce(fail("output_invalid:output_shape", true)).mockResolvedValueOnce(ok());
    const a = await runAttempts(live(), invalidThenOk);
    expect(a).toMatchObject({ attempts: 2, outcome: { ok: true } });
    expect(a.outcomes.map((o) => o.ok)).toEqual([false, true]);

    const rejected = vi.fn().mockResolvedValue(fail("grounding_rejected", false));
    const b = await runAttempts(live(), rejected);
    expect(b).toMatchObject({ attempts: 1, outcome: { ok: false, reason: "grounding_rejected" } });
    expect(rejected).toHaveBeenCalledTimes(1);

    const alwaysInvalid = vi.fn().mockResolvedValue(fail("output_invalid:output_shape", true));
    const c = await runAttempts(live(), alwaysInvalid);
    expect(c.attempts).toBe(2);
    expect(alwaysInvalid).toHaveBeenCalledTimes(2);
  });
});
