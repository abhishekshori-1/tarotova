import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { readingFollowups, readings } from "../db/schema";
import { randomId } from "../ids";
import { loadGrantedReading, type ResultSnapshot } from "../readingService";
import { FollowupStateError, ValidationError } from "../errors";
import { FOCUS_META } from "@/content/focuses";
import { SAFETY_RESPONSES, isRefusalCategory, type SafetyCategory, type SafetyResponse } from "@/content/safety";
import { attemptPolicy, mayAttempt } from "./attempts";
import { FOLLOWUP_ALLOWANCE, GENERATION_LEASE_MS, GENERATION_MAX_ATTEMPTS, GENERATION_REQUEST_DEADLINE_MS, getGenerationConfig } from "./config";
import { FOLLOWUP_GROUNDING_VERSION } from "./grounding-prompts";
import { FOLLOWUP_PROMPT_VERSION } from "./prompts";
import { generateReviewedFollowup } from "./reviewed";
import { getGenerationProvider, reserveBudget } from "./service";
import { getGeneration, viewOf } from "./store";
import type { FollowupInput, FollowupOutput, InterpretationOutput, ProviderCallOptions } from "./types";

export type FollowupRow = typeof readingFollowups.$inferSelect;

export type FollowupTurnView = {
  submissionId: string;
  sequence: number;
  text: string;
} & (
  | { status: "pending" }
  | { status: "succeeded"; answer: FollowupOutput }
  | { status: "refused"; category: SafetyCategory; response: SafetyResponse }
  | { status: "failed"; reason: string; retryable: boolean }
);

/**
 * What the client renders under the reading (docs/RELEASE-C.md section 2).
 * `available` says whether a new turn can be submitted right now and, if
 * not, why; the turns are always returned so history survives every state.
 */
export interface FollowupsView {
  status: "disabled" | "ready";
  available: boolean;
  reason?: "not_configured" | "guest_paused" | "initial_not_ready" | "conversation_closed" | "allowance_exhausted" | "turn_in_flight";
  remaining: number;
  turns: FollowupTurnView[];
}

/** Off switch: no new turns, but what was already shown stays readable. */
function disabledView(rows: FollowupRow[], now: number): FollowupsView {
  return { status: "disabled", available: false, remaining: 0, turns: turnViews(rows, now, false) };
}

function log(event: string, fields: Record<string, unknown>) {
  // Never the message, the answer or the key: ids, states and timings only.
  console.info("[followup]", { event, ...fields });
}

/** The per-row view; `retryable` here means attempts remain. Whether a retry is actually possible depends on the conversation: see turnViews. */
function turnView(row: FollowupRow, now: number): FollowupTurnView {
  const base = { submissionId: row.submissionId, sequence: row.sequence, text: row.text };
  if (row.status === "succeeded" && row.output) return { ...base, status: "succeeded", answer: JSON.parse(row.output) as FollowupOutput };
  if (row.status === "refused" && row.safetyCategory && isRefusalCategory(row.safetyCategory as SafetyCategory)) {
    const category = row.safetyCategory as SafetyCategory;
    return { ...base, status: "refused", category, response: SAFETY_RESPONSES[category as keyof typeof SAFETY_RESPONSES] };
  }
  if ((row.status === "pending" || row.status === "provider_called") && row.leaseExpiresAt > now) return { ...base, status: "pending" };
  // A lapsed lease or a failure: retryable while attempts remain.
  return { ...base, status: "failed", reason: row.errorReason ?? (row.status === "provider_called" ? "lease_expired" : "unknown"), retryable: row.attempts < GENERATION_MAX_ATTEMPTS };
}

/**
 * Views with retry eligibility derived from the whole conversation, matching
 * what requestFollowup will accept: attempts remain, the gate is open (flags,
 * configuration, guest pause, the initial answer), no support response has
 * closed the conversation, no other turn is in flight,
 * and nothing was sent after the failed turn. A retry of the last turn stays
 * possible when all three slots are used.
 */
function turnViews(rows: FollowupRow[], now: number, enabled = true): FollowupTurnView[] {
  const views = rows.map((r) => turnView(r, now));
  const closed = views.some((v) => v.status === "refused");
  const inFlight = views.some((v) => v.status === "pending");
  const last = Math.max(0, ...rows.map((r) => r.sequence));
  return views.map((v) => (v.status === "failed" && v.retryable ? { ...v, retryable: enabled && !closed && !inFlight && v.sequence === last } : v));
}

async function rowsFor(readingId: string, ex: Pick<typeof db, "select"> = db): Promise<FollowupRow[]> {
  return ex.select().from(readingFollowups).where(eq(readingFollowups.readingId, readingId)).orderBy(asc(readingFollowups.sequence));
}

function assemble(rows: FollowupRow[], now: number, gate: { available: boolean; reason?: FollowupsView["reason"] }): FollowupsView {
  // The gate (flags, configuration, guest pause, initial answer) decides retries too; slot exhaustion does not.
  const turns = turnViews(rows, now, gate.available);
  const remaining = Math.max(0, FOLLOWUP_ALLOWANCE - rows.length);
  if (!gate.available) return { status: "ready", available: false, reason: gate.reason, remaining, turns };
  if (turns.some((t) => t.status === "refused")) return { status: "ready", available: false, reason: "conversation_closed", remaining, turns };
  if (turns.some((t) => t.status === "pending")) return { status: "ready", available: false, reason: "turn_in_flight", remaining, turns };
  if (remaining === 0) return { status: "ready", available: false, reason: "allowance_exhausted", remaining, turns };
  return { status: "ready", available: true, remaining, turns };
}

/** Everything but the follow-up rows: flags, configuration, the grant, and the initial answer's state. */
async function gateFor(readingId: string, sessionId: string) {
  const { row: reading, grant, snapshot } = await loadGrantedReading(readingId, sessionId);
  const config = getGenerationConfig();
  if (!config.enabled || !config.followupsEnabled) return { reading, grant, snapshot, config, disabled: true as const, gate: { available: false } };
  const initial = viewOf(await getGeneration(db, readingId), grant.basis, reading.question, Date.now());
  let gate: { available: boolean; reason?: FollowupsView["reason"] } = { available: true };
  if (config.providers.length === 0 || !config.reviewProvider) gate = { available: false, reason: "not_configured" };
  else if (grant.basis === "guest" && !config.guestEnabled) gate = { available: false, reason: "guest_paused" };
  else if (initial.status === "refused") gate = { available: false, reason: "conversation_closed" };
  else if (reading.question && initial.status !== "succeeded") gate = { available: false, reason: "initial_not_ready" };
  const initialAnswer = initial.status === "succeeded" ? initial.answer : null;
  return { reading, grant, snapshot, config, disabled: false as const, gate, initialAnswer };
}

export async function listFollowups(readingId: string, sessionId: string): Promise<FollowupsView> {
  const g = await gateFor(readingId, sessionId);
  const now = Date.now();
  const rows = await rowsFor(readingId);
  if (g.disabled) return disabledView(rows, now);
  return assemble(rows, now, g.gate);
}

/**
 * Accept, resume or report one follow-up turn (docs/RELEASE-C.md section 4).
 * The slot is reserved under a row lock on the reading so a count-then-insert
 * cannot double-allocate; a repeat POST with the same submission id and text
 * returns or resumes the existing turn; a different text under the same id
 * conflicts. The daily budget is charged per paid attempt: the claim
 * transaction pays for the first attempt, so a denied request rolls the claim
 * back and spends no allowance and a duplicate that merely reads an existing
 * turn pays nothing; a further attempt under the same claim pays again before
 * it starts, and stops with `budget_exhausted` if it cannot.
 *
 * Each claim carries a lease token; every later write on the row is
 * conditioned on it, so a worker that outlives its lease cannot overwrite a
 * result written by the request that reclaimed the turn.
 */
export async function requestFollowup(
  readingId: string,
  sessionId: string,
  ip: string,
  submissionId: string,
  text: string,
  options: ProviderCallOptions = { deadlineAt: Date.now() + GENERATION_REQUEST_DEADLINE_MS },
): Promise<FollowupsView> {
  const requestStartedAt = Date.now();
  const g = await gateFor(readingId, sessionId);
  if (g.disabled) throw new ValidationError("followups_disabled");
  if (!g.gate.available) throw new FollowupStateError(g.gate.reason ?? "conversation_closed");
  const { snapshot, grant, config } = g;
  const provider = getGenerationProvider(config)!;

  // Reserve or resume the slot under a lock on the reading; count the budget
  // in the same transaction so a denial rolls the claim back.
  const leaseToken = randomId();
  const claimed = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${readings} where ${readings.id} = ${readingId} for update`);
    const rows = await rowsFor(readingId, tx);
    const t = Date.now();
    const existing = rows.find((r) => r.submissionId === submissionId);
    const charge = async () => {
      const budget = await reserveBudget(sessionId, ip, config, tx);
      if (!budget.allowed) throw new FollowupStateError("busy", Math.max(1, Math.ceil(budget.retryAfterMs / 1000)));
    };
    if (existing) {
      if (existing.text !== text) throw new FollowupStateError("submission_conflict");
      const view = turnView(existing, t);
      if (view.status !== "failed" || !view.retryable) return { row: existing, run: false };
      // A retry is new paid work: it needs the conversation still open, no
      // other turn in flight, and nothing sent after it. A later message (a
      // disclosure, a correction) would otherwise be missing from its context.
      const others = assemble(rows.filter((r) => r.id !== existing.id), t, g.gate);
      if (!others.available && (others.reason === "conversation_closed" || others.reason === "turn_in_flight")) throw new FollowupStateError(others.reason);
      if (rows.some((r) => r.sequence > existing.sequence)) throw new FollowupStateError("retry_superseded");
      await charge();
      const [reclaimed] = await tx
        .update(readingFollowups)
        .set({ status: "pending", leaseExpiresAt: t + GENERATION_LEASE_MS, leaseToken, errorReason: null, updatedAt: t })
        .where(and(eq(readingFollowups.id, existing.id), sql`${readingFollowups.attempts} < ${GENERATION_MAX_ATTEMPTS}`))
        .returning();
      if (!reclaimed) throw new FollowupStateError("turn_in_flight");
      return { row: reclaimed, run: true };
    }
    const state = assemble(rows, t, g.gate);
    if (!state.available) throw new FollowupStateError(state.reason ?? "conversation_closed");
    await charge();
    const [inserted] = await tx
      .insert(readingFollowups)
      .values({
        id: randomId(),
        readingId,
        submissionId,
        sequence: rows.length + 1,
        text,
        status: "pending",
        attempts: 0,
        leaseExpiresAt: t + GENERATION_LEASE_MS,
        leaseToken,
        promptVersion: FOLLOWUP_PROMPT_VERSION,
        reviewVersion: FOLLOWUP_GROUNDING_VERSION,
        contentVersion: snapshot.contentVersion,
        createdAt: t,
        updatedAt: t,
      })
      .returning();
    return { row: inserted, run: true };
  });
  if (!claimed.run) return assemble(await rowsFor(readingId), Date.now(), g.gate);
  const row = claimed.row;
  log("claimed", { readingId, followupId: row.id, sequence: row.sequence, attempts: row.attempts, basis: grant.basis });

  // Every write from here on belongs to this claim. Zero rows means another
  // request reclaimed the turn after our lease lapsed: stop without writing.
  const owned = and(eq(readingFollowups.id, row.id), eq(readingFollowups.leaseToken, leaseToken));
  const write = async (values: Partial<typeof readingFollowups.$inferInsert>): Promise<boolean> => {
    const updated = await db.update(readingFollowups).set(values).where(owned).returning({ id: readingFollowups.id });
    if (updated.length === 0) log("lease_lost", { readingId, followupId: row.id, attempts });
    return updated.length > 0;
  };

  const priorRows = (await rowsFor(readingId)).filter((r) => r.sequence < row.sequence);
  const context = { originalQuestion: g.reading.question, priorUserMessages: priorRows.map((r) => r.text) };
  const drawnCardIds = snapshot.cards.map((c) => c.id);
  let attempts = row.attempts;
  let safetyCategory = (row.safetyCategory as SafetyCategory | null) ?? null;
  let lastReason = "request_deadline";

  const policy = attemptPolicy(options.deadlineAt, requestStartedAt);
  while (mayAttempt(attempts, row.attempts, policy)) {
    if (attempts > row.attempts) {
      // A further paid attempt under this claim; the claim itself paid for the first.
      const budget = await reserveBudget(sessionId, ip, config);
      if (!budget.allowed) {
        lastReason = "budget_exhausted";
        log("budget_exhausted", { readingId, followupId: row.id, attempts, scope: budget.scope });
        break;
      }
    }
    attempts += 1;
    const startedAt = Date.now();
    if (!(await write({ status: "provider_called", attempts, leaseExpiresAt: startedAt + GENERATION_LEASE_MS, model: config.providers[0].models.answer, updatedAt: startedAt }))) return assemble(await rowsFor(readingId), Date.now(), g.gate);

    if (safetyCategory === null) {
      const classified = await provider.classify(text, options, context);
      if (!classified.ok) {
        lastReason = classified.reason;
        log("classifier_failed", { readingId, followupId: row.id, attempts, reason: classified.reason, durationMs: Date.now() - startedAt });
        if (classified.retryable) continue;
        break;
      }
      safetyCategory = classified.value;
      if (!(await write({ safetyCategory, updatedAt: Date.now() }))) return assemble(await rowsFor(readingId), Date.now(), g.gate);
    }
    if (isRefusalCategory(safetyCategory)) {
      const t = Date.now();
      if (!(await write({ status: "refused", completedAt: t, updatedAt: t, leaseExpiresAt: t }))) return assemble(await rowsFor(readingId), t, g.gate);
      log("refused", { readingId, followupId: row.id, category: safetyCategory, attempts, durationMs: t - startedAt });
      return assemble(await rowsFor(readingId), t, g.gate);
    }

    const input = buildFollowupInput(snapshot, g.reading.question, g.initialAnswer, priorRows, text, safetyCategory === "stressful" ? "stressful" : "none");
    const outcome = await generateReviewedFollowup(provider, input, drawnCardIds, options);
    if (!outcome.ok) {
      lastReason = outcome.reason;
      log("provider_failed", { readingId, followupId: row.id, attempts, reason: outcome.reason, uncertain: outcome.uncertain, qualityCalls: outcome.quality.calls, repaired: outcome.quality.repairAttempted, durationMs: Date.now() - startedAt });
      if (outcome.retryable) continue;
      break;
    }
    const t = Date.now();
    if (!(await write({ status: "succeeded", output: JSON.stringify(outcome.value), model: outcome.model, completedAt: t, updatedAt: t, leaseExpiresAt: t }))) return assemble(await rowsFor(readingId), t, g.gate);
    log("succeeded", { readingId, followupId: row.id, sequence: row.sequence, attempts, provider: provider.name, model: outcome.model, usage: outcome.usage, qualityCalls: outcome.quality.calls, repaired: outcome.quality.repairAttempted, durationMs: t - startedAt });
    return assemble(await rowsFor(readingId), t, g.gate);
  }

  const t = Date.now();
  if (!(await write({ status: "failed", errorReason: lastReason, attempts, updatedAt: t, leaseExpiresAt: t }))) return assemble(await rowsFor(readingId), t, g.gate);
  log("failed", { readingId, followupId: row.id, attempts, reason: lastReason });
  return assemble(await rowsFor(readingId), t, g.gate);
}

/** Shared by production and eval: this reading only, speakers preserved, generated text marked. */
export function buildFollowupInput(
  snapshot: Pick<ResultSnapshot, "focus" | "cards">,
  originalQuestion: string | null,
  initialAnswer: InterpretationOutput | null,
  priorRows: Pick<FollowupRow, "text" | "status" | "output">[],
  latest: string,
  safetyCategory: "none" | "stressful",
  journeyPrompt?: string,
): FollowupInput {
  return {
    focusLabel: FOCUS_META[snapshot.focus].label,
    cards: snapshot.cards.map((c) => ({ position: c.position, name: c.name, keywords: c.keywords, coreMeaning: c.coreMeaning ?? "", positionText: c.interpretation, focusNote: c.focusNote })),
    originalQuestion,
    initialAnswer,
    priorTurns: priorRows.map((r) => ({ user: r.text, assistant: r.status === "succeeded" && r.output ? (JSON.parse(r.output) as FollowupOutput) : null })),
    latest,
    safetyCategory,
    ...(journeyPrompt ? { journeyPrompt } : {}),
  };
}
