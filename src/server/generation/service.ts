import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { readingGenerations } from "../db/schema";
import { randomId } from "../ids";
import { checkAndIncrement } from "../rateLimit";
import { loadGrantedReading } from "../readingService";
import { isRefusalCategory, type SafetyCategory } from "@/content/safety";
import { AnthropicProvider } from "./anthropic";
import { GENERATION_KIND, GENERATION_LEASE_MS, GENERATION_MAX_ATTEMPTS, GENERATION_REQUEST_BUDGET_MS, GENERATION_REQUEST_DEADLINE_MS, getGenerationConfig, type GenerationConfig, type ProviderSpec } from "./config";
import { FallbackProvider } from "./fallback";
import { GeminiProvider } from "./gemini";
import { DeepSeekProvider } from "./deepseek";
import { INTERPRETATION_PROMPT_VERSION } from "./prompts";
import { StubProvider } from "./stub";
import { BUDGET_REASON, getGeneration, viewOf, type GenerationRow } from "./store";
import type { GenerationProvider, InterpretationView, ProviderCallOptions } from "./types";
import { buildInterpretationInput } from "./input";
import { validateInterpretation } from "./validate";
import { generateReviewed } from "./reviewed";

const DAY_MS = 24 * 60 * 60 * 1000;

let stub: StubProvider | undefined;

function buildProvider(spec: ProviderSpec, timeoutMs: number): GenerationProvider {
  switch (spec.kind) {
    case "gemini":
      return new GeminiProvider(spec.apiKey!, spec.models, timeoutMs);
    case "anthropic":
      return new AnthropicProvider(spec.apiKey!, spec.models, timeoutMs, spec.workspaceId, undefined, spec.promptCache);
    case "deepseek":
      return new DeepSeekProvider(spec.apiKey!, spec.models, timeoutMs);
    case "stub":
      return (stub ??= new StubProvider());
  }
}

/** The configured chain (preferred first) as one provider, or undefined when nothing can generate. */
export function getGenerationProvider(config: GenerationConfig): GenerationProvider | undefined {
  if (config.providers.length === 0) return undefined;
  const chain = config.providers.map((spec) => buildProvider(spec, config.timeoutMs));
  const writer = chain.length === 1 ? chain[0] : new FallbackProvider(chain, (from, to, reason, detail) => log("fallback", { from, to, reason, detail }));
  const reviewer = config.reviewProvider ? buildProvider(config.reviewProvider, config.timeoutMs) : undefined;
  const classifier = config.classifierProvider ? buildProvider(config.classifierProvider, config.timeoutMs) : writer;
  return {
    name: writer.name,
    classify: (question, options, context) => classifier.classify(question, options, context),
    interpret: (input, options) => writer.interpret(input, options),
    repair: (input, answer, issues, options) => writer.repair(input, answer, issues, options),
    review: (input, answer, options) => reviewer ? reviewer.review(input, answer, options) : Promise.resolve({ ok: false, reason: "reviewer_not_configured", retryable: false, uncertain: false }),
    followup: (input, options) => writer.followup(input, options),
    repairFollowup: (input, answer, issues, options) => writer.repairFollowup(input, answer, issues, options),
    reviewFollowup: (input, answer, options) => reviewer ? reviewer.reviewFollowup(input, answer, options) : Promise.resolve({ ok: false, reason: "reviewer_not_configured", retryable: false, uncertain: false }),
  };
}

function log(event: string, fields: Record<string, unknown>) {
  // Never the question, the answer or the key — ids, states and timings only.
  console.info("[generation]", { event, ...fields });
}

/**
 * The one entry point (docs/PLAN-EXTENDED.md section 9 "Contextual answer"):
 * idempotent, authorized by the reading's access grant, and safe to call
 * from several tabs — the row is a lease claimed with conditional updates,
 * the budget is reserved *before* the provider is called, and the paid
 * attempt is recorded *before* the response is awaited so a crash after
 * the call can never produce an unbounded retry.
 */
export async function requestInterpretation(readingId: string, sessionId: string, ip: string, options: ProviderCallOptions = { deadlineAt: Date.now() + GENERATION_REQUEST_DEADLINE_MS }): Promise<InterpretationView> {
  const requestStartedAt = Date.now();
  const { row: reading, grant, snapshot } = await loadGrantedReading(readingId, sessionId);
  const config = getGenerationConfig();
  const now = Date.now();
  const existing = await getGeneration(db, readingId);
  const current = viewOf(existing, grant.basis, reading.question, now);

  if (config.enabled && reading.question && config.configurationProblem) {
    (config.providers.length === 0 ? console.error : console.warn)("[generation_configuration]", { reason: config.configurationProblem, usable: config.providers.map((p) => p.kind) });
  }
  // Only idle and retryable failures do work; everything else is already the answer.
  if (current.status !== "idle" && !(current.status === "failed" && current.retryable)) return current;
  if (Date.now() >= options.deadlineAt) return { status: "failed", reason: "request_deadline", retryable: true, ...("classifiedCategory" in current ? { classifiedCategory: current.classifiedCategory } : {}) };
  const provider = getGenerationProvider(config);
  if (!provider) return { status: "unavailable", reason: "not_configured" };

  const claimed = await claim(existing, readingId, reading.contentVersion, now);
  if (!claimed) {
    // Another request holds the lease (or finished): report its state.
    return viewOf(await getGeneration(db, readingId), grant.basis, reading.question, Date.now());
  }
  log("claimed", { readingId, generationId: claimed.id, attempts: claimed.attempts, basis: grant.basis });

  // Budgets, reserved before any paid call (docs/REVIEW-V2.md finding 2).
  const budget = await reserveBudget(sessionId, ip, config);
  if (!budget.allowed) {
    await db
      .update(readingGenerations)
      .set({ status: "failed", errorReason: BUDGET_REASON, leaseExpiresAt: now + budget.retryAfterMs, updatedAt: Date.now() })
      .where(eq(readingGenerations.id, claimed.id));
    log("budget_exhausted", { readingId, generationId: claimed.id, scope: budget.scope, retryAfterMs: budget.retryAfterMs });
    return viewOf(await getGeneration(db, readingId), grant.basis, reading.question, Date.now());
  }

  const question = reading.question!;
  const drawnCardIds = snapshot.cards.map((c) => c.id);

  let attempts = claimed.attempts;
  let safetyCategory = (claimed.safetyCategory as SafetyCategory | null) ?? null;
  let lastReason = "request_deadline";

  // A second attempt only starts while the request still has time for it;
  // otherwise the row's lease lapses and a later request picks it up.
  while (attempts < GENERATION_MAX_ATTEMPTS && Date.now() < options.deadlineAt && (attempts === claimed.attempts || Date.now() - requestStartedAt < GENERATION_REQUEST_BUDGET_MS)) {
    attempts += 1;
    const startedAt = Date.now();
    // Recorded before the await: a lost response still counts as a paid attempt.
    await db
      .update(readingGenerations)
      .set({ status: "provider_called", attempts, leaseExpiresAt: startedAt + GENERATION_LEASE_MS, model: config.providers[0].models.answer, updatedAt: startedAt })
      .where(eq(readingGenerations.id, claimed.id));

    if (safetyCategory === null) {
      const classified = await provider.classify(question, options);
      if (!classified.ok) {
        lastReason = classified.reason;
        log("classifier_failed", { readingId, generationId: claimed.id, attempts, reason: classified.reason, detail: classified.detail, durationMs: Date.now() - startedAt });
        if (classified.retryable) continue;
        break;
      }
      safetyCategory = classified.value;
      await db.update(readingGenerations).set({ safetyCategory, updatedAt: Date.now() }).where(eq(readingGenerations.id, claimed.id));
    }

    // Also checked on a reclaimed row: a previous request may have saved
    // the classification and died before persisting the refusal status.
    if (isRefusalCategory(safetyCategory)) {
      const t = Date.now();
      await db
        .update(readingGenerations)
        .set({ status: "refused", completedAt: t, updatedAt: t, leaseExpiresAt: t })
        .where(eq(readingGenerations.id, claimed.id));
      log("refused", { readingId, generationId: claimed.id, category: safetyCategory, attempts, durationMs: t - startedAt });
      return viewOf(await getGeneration(db, readingId), grant.basis, question, t);
    }
    // Preserve triage/library access, but do not pay for an unpublishable draft.
    if (!config.reviewProvider) {
      lastReason = "grounding_review:reviewer_not_configured";
      break;
    }
    const input = buildInterpretationInput(question, snapshot, safetyCategory === "stressful" ? "stressful" : "none");
    const outcome = await generateReviewed(provider, input, drawnCardIds, options);
    if (!outcome.ok) {
      lastReason = outcome.reason;
      log("provider_failed", { readingId, generationId: claimed.id, attempts, reason: outcome.reason, detail: outcome.detail, uncertain: outcome.uncertain, qualityCalls: outcome.quality.calls, repaired: outcome.quality.repairAttempted, durationMs: Date.now() - startedAt });
      if (outcome.retryable) continue;
      break;
    }
    const validated = validateInterpretation(outcome.value, drawnCardIds);
    if (!validated.ok) {
      lastReason = `output_invalid:${validated.reason}`;
      log("output_rejected", { readingId, generationId: claimed.id, attempts, reason: validated.reason, detail: validated.detail, durationMs: Date.now() - startedAt });
      continue;
    }
    const t = Date.now();
    await db
      .update(readingGenerations)
      .set({ status: "succeeded", output: JSON.stringify(validated.output), model: outcome.model, completedAt: t, updatedAt: t, leaseExpiresAt: t })
      .where(eq(readingGenerations.id, claimed.id));
    log("succeeded", { readingId, generationId: claimed.id, attempts, provider: provider.name, model: outcome.model, usage: outcome.usage, qualityCalls: outcome.quality.calls, repaired: outcome.quality.repairAttempted, durationMs: t - startedAt });
    return viewOf(await getGeneration(db, readingId), grant.basis, question, t);
  }

  const t = Date.now();
  await db
    .update(readingGenerations)
    .set({ status: "failed", errorReason: lastReason, attempts, updatedAt: t, leaseExpiresAt: t })
    .where(eq(readingGenerations.id, claimed.id));
  log("failed", { readingId, generationId: claimed.id, attempts, reason: lastReason });
  return viewOf(await getGeneration(db, readingId), grant.basis, question, t);
}

/**
 * Takes the lease. A missing row is inserted (a concurrent insert loses on
 * the unique index); an existing row is re-claimed only when its lease has
 * lapsed or it failed, and only while attempts remain. Returns undefined
 * when someone else holds it.
 */
async function claim(existing: GenerationRow | undefined, readingId: string, contentVersion: string, now: number): Promise<GenerationRow | undefined> {
  const leaseExpiresAt = now + GENERATION_LEASE_MS;
  if (!existing) {
    const [inserted] = await db
      .insert(readingGenerations)
      .values({
        id: randomId(),
        readingId,
        kind: GENERATION_KIND,
        status: "pending",
        attempts: 0,
        leaseExpiresAt,
        promptVersion: INTERPRETATION_PROMPT_VERSION,
        contentVersion,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: [readingGenerations.readingId, readingGenerations.kind] })
      .returning();
    return inserted;
  }
  const [reclaimed] = await db
    .update(readingGenerations)
    .set({ status: "pending", leaseExpiresAt, errorReason: null, promptVersion: INTERPRETATION_PROMPT_VERSION, updatedAt: now })
    .where(
      and(
        eq(readingGenerations.id, existing.id),
        or(and(inArray(readingGenerations.status, ["pending", "provider_called"]), lte(readingGenerations.leaseExpiresAt, now)), eq(readingGenerations.status, "failed")),
        sql`${readingGenerations.attempts} < ${GENERATION_MAX_ATTEMPTS}`,
      ),
    )
    .returning();
  return reclaimed;
}

export async function reserveBudget(sessionId: string, ip: string, config: GenerationConfig) {
  const scopes = [
    { scope: "session", identifier: `session:${sessionId}`, limit: config.limits.sessionPerDay },
    { scope: "ip", identifier: `ip:${ip}`, limit: config.limits.ipPerDay },
    { scope: "global", identifier: "global", limit: config.limits.globalPerDay },
  ];
  for (const { scope, identifier, limit } of scopes) {
    const result = await checkAndIncrement(identifier, { action: "generation_day", windowMs: DAY_MS, limit });
    if (!result.allowed) return { allowed: false as const, scope, retryAfterMs: result.retryAfterMs };
  }
  return { allowed: true as const };
}
