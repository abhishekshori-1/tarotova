import { afterEach, describe, expect, it, vi } from "vitest";
import { applyGroundingRepair, generateReviewed, parseGroundingReview } from "./reviewed";
import type { GenerationProvider, GroundingReview, InterpretationInput, InterpretationOutput } from "./types";

const ids = ["major-00-fool", "major-14-temperance", "major-09-hermit"];
const input: InterpretationInput = { question: "I stop projects after a week. I want to understand, not get a routine.", focusLabel: "Personal growth", safetyCategory: "none", cards: [
  { position: "situation", name: "The Fool", keywords: [], coreMeaning: "A beginning.", positionText: "An open start.", focusNote: "Curiosity." },
  { position: "challenge", name: "Temperance", keywords: [], coreMeaning: "Pace.", positionText: "A measured approach.", focusNote: "Balance." },
  { position: "guidance", name: "The Hermit", keywords: [], coreMeaning: "Reflection.", positionText: "Time to look.", focusNote: "Understanding." },
] };
const draft: InterpretationOutput = {
  perspective: "These three themes offer places to look at the moment you stop. The question of what happens there stays open.",
  cards: [
    { position: "situation", relevance: "The Fool brings an open beginning into view as a theme to consider." },
    { position: "challenge", relevance: "Temperance names pacing as the reason you stop. A week is enough to know that." },
    { position: "guidance", relevance: "The Hermit offers reflection as a way of looking without demanding a restart." },
  ],
  reflection: "What do you notice at the moment you stop?",
  beyondSpread: null,
};
const replacement = "Temperance offers pace as a theme. Does pace play any part in this, or is it unrelated?";
const revise: GroundingReview = { decision: "revise", issues: [{ field: "challenge", quote: "pacing as the reason you stop", reason: "The question does not supply a cause." }] };
const pass: GroundingReview = { decision: "pass", issues: [] };
const ok = (value: unknown, model = "test-model") => ({ ok: true as const, value, model, usage: { inputTokens: 10, outputTokens: 5 } });
function fake() {
  return {
    name: "test",
    classify: vi.fn(),
    interpret: vi.fn().mockResolvedValue(ok(draft, "writer")),
    review: vi.fn().mockResolvedValue(ok(pass, "reviewer")),
    repair: vi.fn().mockResolvedValue(ok({ edits: [{ field: "challenge", replacement }] }, "repairer")),
  } satisfies GenerationProvider;
}
afterEach(() => vi.restoreAllMocks());

describe("reviewed publication", () => {
  it("publishes only after the review completes, with review usage included", async () => {
    const p = fake();
    let finish!: (v: unknown) => void;
    p.review.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const done = vi.fn();
    const pending = generateReviewed(p, input, ids).then((r) => { done(); return r; });
    await vi.waitFor(() => expect(p.review).toHaveBeenCalledOnce());
    expect(done).not.toHaveBeenCalled();
    finish(ok(pass));
    expect(await pending).toMatchObject({ ok: true, value: draft, model: "writer", usage: { inputTokens: 20, outputTokens: 10 } });
    expect(p.repair).not.toHaveBeenCalled();
  });

  it("repairs only flagged fields and reviews the entire repaired answer in a fresh call", async () => {
    const p = fake();
    p.review.mockResolvedValueOnce(ok(revise)).mockResolvedValueOnce(ok(pass));
    const options = { deadlineAt: Date.now() + 55_000 };
    const result = await generateReviewed(p, input, ids, options);
    expect(result).toMatchObject({ ok: true, model: "repairer", usage: { inputTokens: 40, outputTokens: 20 }, quality: { repairAttempted: true } });
    if (!result.ok) throw new Error("Expected approved repair");
    expect(result.value).toEqual({ ...draft, cards: draft.cards.map((c) => c.position === "challenge" ? { ...c, relevance: replacement } : c) });
    expect(draft.cards[1].relevance).toContain("pacing as the reason");
    expect(p.review).toHaveBeenNthCalledWith(2, input, result.value, options);
    expect(p.repair).toHaveBeenCalledWith(input, draft, revise.issues, options);
  });

  it("withholds after one repair if the fresh review finds another issue", async () => {
    const p = fake();
    const next: GroundingReview = { decision: "revise", issues: [{ field: "challenge", quote: "pace as a theme", reason: "Test issue in the repaired answer." }] };
    p.review.mockResolvedValueOnce(ok(revise)).mockResolvedValueOnce(ok(next));
    const result = await generateReviewed(p, input, ids);
    expect(result).toMatchObject({ ok: false, reason: "grounding_rejected", retryable: false });
    expect(result).not.toHaveProperty("value");
    expect(p.repair).toHaveBeenCalledOnce();
    expect(p.interpret).toHaveBeenCalledOnce();
  });

  it.each([null, {}, { decision: "pass", issues: revise.issues }, { decision: "revise", issues: [] }, { decision: "pass", issues: [], ignored: true }, { decision: "revise", issues: [{ ...revise.issues[0], quote: "not in this answer" }] }])("rejects malformed or inconsistent review output: %j", async (value) => {
    const p = fake(); p.review.mockResolvedValue(ok(value));
    expect(await generateReviewed(p, input, ids)).toMatchObject({ ok: false, reason: "grounding_review_invalid", retryable: false });
    expect(p.repair).not.toHaveBeenCalled();
  });

  it("relocates an issue whose field label is wrong when its quote is unique, and stays invalid otherwise", async () => {
    const p = fake();
    p.review.mockResolvedValueOnce(ok({ decision: "revise", issues: [{ field: "cards", quote: "pacing as the reason you stop", reason: "Unsupported cause." }] })).mockResolvedValueOnce(ok(pass));
    const result = await generateReviewed(p, input, ids);
    expect(result).toMatchObject({ ok: true, quality: { repairAttempted: true } });
    expect(p.repair).toHaveBeenCalledWith(input, draft, [{ field: "challenge", quote: "pacing as the reason you stop", reason: "Unsupported cause." }], expect.anything());

    const q = fake();
    q.review.mockResolvedValue(ok({ decision: "revise", issues: [{ field: "cards", quote: "The", reason: "Ambiguous quote." }] }));
    expect(await generateReviewed(q, input, ids)).toMatchObject({ ok: false, reason: "grounding_review_invalid" });
  });

  it.each(["review", "repair"] as const)("does not publish on a %s provider failure", async (phase) => {
    const p = fake();
    if (phase === "repair") p.review.mockResolvedValue(ok(revise));
    p[phase].mockResolvedValue({ ok: false, reason: "provider_timeout", retryable: true, uncertain: true });
    const result = await generateReviewed(p, input, ids);
    expect(result).toMatchObject({ ok: false, reason: `grounding_${phase}:provider_timeout`, retryable: false, uncertain: true });
    expect(result).not.toHaveProperty("value");
  });

  it("preserves terminal provider refusal semantics during review", async () => {
    const p = fake();
    p.review.mockResolvedValue({ ok: false, reason: "provider_blocked", retryable: false, uncertain: false });
    expect(await generateReviewed(p, input, ids)).toMatchObject({ ok: false, reason: "provider_blocked", retryable: false });
  });

  it.each([
    [{ field: "perspective", replacement: "An unflagged rewrite." }],
    [{ field: "challenge", replacement }, { field: "challenge", replacement }],
    [{ field: "challenge", replacement: null }],
    [{ field: "challenge", replacement: "Too short." }],
    [{ field: "challenge", replacement: "The Tower shows another problem which this spread did not draw." }],
  ].map((edits) => ({ edits })))("rejects invalid, unflagged or structurally unsafe repairs", async ({ edits }) => {
    const p = fake(); p.review.mockResolvedValue(ok(revise)); p.repair.mockResolvedValue(ok({ edits }));
    const result = await generateReviewed(p, input, ids);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Unsafe repair published");
    expect(result.reason).toMatch(/^grounding_repair_invalid/);
    expect(p.review).toHaveBeenCalledOnce();
  });

  it.each(["write", "review", "repair", "final-review"])("withholds if %s consumes the shared deadline, even on a late success", async (phase) => {
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const p = fake();
    if (phase === "write") p.interpret.mockImplementation(async () => { now = 2000; return ok(draft); });
    else if (phase === "review") p.review.mockImplementation(async () => { now = 2000; return ok(pass); });
    else {
      p.review.mockResolvedValueOnce(ok(revise));
      if (phase === "repair") p.repair.mockImplementation(async () => { now = 2000; return ok({ edits: [{ field: "challenge", replacement }] }); });
      else p.review.mockImplementationOnce(async () => { now = 2000; return ok(pass); });
    }
    const result = await generateReviewed(p, input, ids, { deadlineAt: 2000 });
    expect(result).toMatchObject({ ok: false, reason: "request_deadline" });
    expect(result).not.toHaveProperty("value");
    for (const call of p.review.mock.calls) expect(call[2]).toEqual({ deadlineAt: 2000 });
    for (const call of p.repair.mock.calls) expect(call[3]).toEqual({ deadlineAt: 2000 });
  });

  it("does no work after an expired deadline", async () => {
    const p = fake();
    expect(await generateReviewed(p, input, ids, { deadlineAt: Date.now() - 1 })).toMatchObject({ ok: false, reason: "request_deadline" });
    expect(p.interpret).not.toHaveBeenCalled();
  });

  it("locates a uniquely quoted field without trusting a wrong label, but rejects ambiguous locations", () => {
    expect(parseGroundingReview({ ...revise, issues: [{ ...revise.issues[0], field: "reflection" }] }, draft)).toEqual(revise);
    expect(parseGroundingReview({ ...revise, issues: [{ ...revise.issues[0], field: "beyondSpread", quote: "The " }] }, draft)).toBeUndefined();
  });

  it("ignores incidental issue annotations without changing the verdict or finding", () => {
    expect(parseGroundingReview({ ...revise, issues: [{ ...revise.issues[0], relevance_note: "n/a" }] }, draft)).toEqual(revise);
    expect(parseGroundingReview({ decision: "revise", issues: [{ field: "challenge", relevance_note: "pass", reason: "No quote supplied." }] }, draft)).toBeUndefined();
  });

  it("rejects a repair missing a flagged field", () => {
    expect(applyGroundingRepair({ edits: [{ field: "challenge", replacement }] }, draft, { decision: "revise", issues: [...revise.issues, { field: "reflection", quote: "What do you notice", reason: "Test second field." }] })).toBeUndefined();
  });
});
