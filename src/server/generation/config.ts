/**
 * Release B flags and budgets (docs/REVIEW-V2.md finding 2). Everything is
 * read at call time so a redeploy with a changed variable takes effect
 * without code changes; nothing here is inlined at build time.
 *
 * - GENERATION_ENABLED: master flag; off means the result carries no
 *   personalized section at all (Release A behaviour).
 * - GUEST_GENERATION_ENABLED: the guest-only kill switch — verified sessions
 *   keep generating while anonymous spend is paused.
 * - GENERATION_PROVIDER: an ordered, comma-separated chain. "gemini,deepseek"
 *   (the production default) prefers Gemini and falls back to DeepSeek when
 *   Gemini fails; "stub" is the free offline provider for dev/tests. An entry
 *   whose key is missing is skipped and named in `configurationProblem`;
 *   production never falls back to the stub — with no usable provider the
 *   answer is reported "unavailable" and logged, never silently faked.
 * - GENERATION_CLASSIFIER_PROVIDER: triage by a vendor other than the writer
 *   chain's first (its <VENDOR>_CLASSIFIER_MODEL applies). Unset keeps the
 *   chain's first provider. No fallback: an explicit classifier that fails
 *   fails the attempt, like the reviewer.
 * - GENERATION_REPAIR_PROVIDER: repairs by a vendor other than the writer
 *   chain (its <VENDOR>_ANSWER_MODEL applies). Unset keeps the writer chain.
 *   It replaces the repair call; the pipeline still makes at most one repair
 *   and one fresh review under the same deadline and budget. One review
 *   transport failure may retry the same candidate within that deadline.
 * - GENERATION_REVIEW_PROVIDER / GENERATION_REVIEW_MODEL: the grounding
 *   reviewer, configured independently of the writer chain. No vendor is
 *   assumed; unset means every generated answer is withheld after triage
 *   and the problem is logged. Release C's cost configuration uses Gemini
 *   review and triage, DeepSeek writing and repair, and Gemini writer fallback.
 *   Calibration and release results are recorded in docs/RELEASE-C.md.
 */
export const GENERATION_MAX_ATTEMPTS = 2; // bounded pipelines per reading; each may write, review, repair once, review again
export const GENERATION_LEASE_MS = 90_000; // a request holds the row this long
export const GENERATION_KIND = "interpretation";
/**
 * Stop provider work five seconds before the route's 60-second limit,
 * leaving time to save the outcome and return it. The deadline starts at
 * route entry, before migration/session/database work.
 */
export const GENERATION_REQUEST_DEADLINE_MS = 55_000;
/** Avoid starting a second paid attempt late in the request. */
export const GENERATION_REQUEST_BUDGET_MS = 25_000;

export type ProviderKind = "gemini" | "anthropic" | "deepseek" | "stub";

export interface ProviderSpec {
  kind: ProviderKind;
  apiKey?: string;
  /** Anthropic only: required by the API when the key is organization-level rather than workspace-scoped. */
  workspaceId?: string;
  /** Anthropic only: opt-in prompt caching of the system prompt, ANTHROPIC_PROMPT_CACHE=5m|1h. */
  promptCache?: "5m" | "1h";
  /** Gemini only; independently configured role effort, unset preserves the model default. */
  thinkingLevel?: "low" | "medium" | "high";
  models: { answer: string; classifier: string };
}

export interface GenerationLimits {
  sessionPerDay: number;
  ipPerDay: number;
  globalPerDay: number;
}

/** Follow-up turns per reading (docs/RELEASE-C.md section 2); a support response or a failed turn spends one. */
export const FOLLOWUP_ALLOWANCE = 3;

export interface GenerationConfig {
  enabled: boolean;
  guestEnabled: boolean;
  /** Release C follow-ups; requires `enabled` too. */
  followupsEnabled: boolean;
  /** Usable providers, in preference order; empty means nothing can generate. */
  providers: ProviderSpec[];
  /** Dedicated reviewer: no fallback to a weaker model after a review failure. */
  reviewProvider?: ProviderSpec;
  /** Repairs flagged fields when set; otherwise the writer chain repairs its own drafts. */
  repairProvider?: ProviderSpec;
  /** Dedicated classifier; unset means the writer chain's first provider triages. */
  classifierProvider?: ProviderSpec;
  /** What was skipped or wrong, for the log line. */
  configurationProblem?: string;
  timeoutMs: number;
  limits: GenerationLimits;
}

function flag(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

function positiveInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]?.trim());
  return Number.isInteger(raw) && raw > 0 ? raw : fallback;
}

function env(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function thinkingLevel(name: string): ProviderSpec["thinkingLevel"] {
  return (["low", "medium", "high"] as const).find((v) => v === env(name));
}

type Resolved = { spec: ProviderSpec; problem?: undefined } | { spec?: undefined; problem: string };

/** One provider kind → its spec from the environment, or the reason it cannot be used. */
/** Exported for the evaluation harnesses that build a single vendor on purpose (a repairer to compare, say). */
export function specFor(kind: string, production: boolean): Resolved {
  if (kind === "gemini") {
    const apiKey = env("GEMINI_API_KEY");
    if (!apiKey) return { problem: "gemini skipped: GEMINI_API_KEY is not set." };
    return { spec: { kind, apiKey, thinkingLevel: thinkingLevel("GEMINI_WRITER_THINKING_LEVEL"), models: { answer: env("GEMINI_MODEL") ?? "gemini-3.8-flash", classifier: env("GEMINI_CLASSIFIER_MODEL") ?? "gemini-3.8-flash" } } };
  }
  if (kind === "anthropic") {
    const apiKey = env("ANTHROPIC_API_KEY");
    if (!apiKey) return { problem: "anthropic skipped: ANTHROPIC_API_KEY is not set." };
    return {
      spec: {
        kind,
        apiKey,
        workspaceId: env("ANTHROPIC_WORKSPACE_ID"),
        promptCache: (["5m", "1h"] as const).find((v) => v === env("ANTHROPIC_PROMPT_CACHE")),
        models: { answer: env("ANTHROPIC_MODEL", "GENERATION_MODEL") ?? "claude-sonnet-5", classifier: env("ANTHROPIC_CLASSIFIER_MODEL", "CLASSIFIER_MODEL") ?? "claude-haiku-4-5-20251001" },
      },
    };
  }
  if (kind === "deepseek") {
    const apiKey = env("DEEPSEEK_API_KEY");
    if (!apiKey) return { problem: "deepseek skipped: DEEPSEEK_API_KEY is not set." };
    return { spec: { kind, apiKey, models: { answer: env("DEEPSEEK_MODEL") ?? "deepseek-flash", classifier: env("DEEPSEEK_CLASSIFIER_MODEL") ?? "deepseek-flash" } } };
  }
  if (kind === "stub") {
    if (production) return { problem: "stub skipped: not available in production." };
    return { spec: { kind, models: { answer: "stub-answer", classifier: "stub-classifier" } } };
  }
  return { problem: `unknown provider ${JSON.stringify(kind)} skipped.` };
}

export function getGenerationConfig(): GenerationConfig {
  const production = process.env.NODE_ENV === "production";
  const requested = (env("GENERATION_PROVIDER") ?? (production ? "gemini,deepseek" : "stub"))
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const providers: ProviderSpec[] = [];
  const problems: string[] = [];
  for (const kind of requested) {
    const resolved = specFor(kind, production);
    if (resolved.spec) providers.push(resolved.spec);
    else problems.push(resolved.problem);
  }
  if (providers.length === 0 && problems.length === 0) problems.push("GENERATION_PROVIDER is empty.");

  // The reviewer is configured on its own: any vendor, in the writer chain
  // or not, and never assumed. Only the offline stub is implied, and only
  // when the writer chain is the stub outside production.
  const stubOnly = !production && requested.length > 0 && requested.every((k) => k === "stub");
  const reviewKind = env("GENERATION_REVIEW_PROVIDER")?.toLowerCase() ?? (stubOnly ? "stub" : undefined);
  let reviewProvider: ProviderSpec | undefined;
  if (!reviewKind) {
    problems.push("GENERATION_REVIEW_PROVIDER is not set; generated answers will be withheld after triage.");
  } else {
    const resolved = specFor(reviewKind, production);
    if (resolved.spec) reviewProvider = {
      ...resolved.spec,
      ...(resolved.spec.kind === "gemini" ? { thinkingLevel: thinkingLevel("GEMINI_REVIEW_THINKING_LEVEL") } : {}),
      models: { ...resolved.spec.models, answer: env("GENERATION_REVIEW_MODEL") ?? resolved.spec.models.answer },
    };
    else problems.push(`reviewer unavailable (${resolved.problem}); generated answers will be withheld after triage.`);
  }

  // The classifier can be split from the writer chain (Gemini triaging a
  // DeepSeek writer, say). Unset keeps the writer chain's first provider.
  let classifierProvider: ProviderSpec | undefined;
  const classifierKind = env("GENERATION_CLASSIFIER_PROVIDER")?.toLowerCase();
  if (classifierKind) {
    const resolved = specFor(classifierKind, production);
    if (resolved.spec) classifierProvider = { ...resolved.spec, ...(resolved.spec.kind === "gemini" ? { thinkingLevel: thinkingLevel("GEMINI_CLASSIFIER_THINKING_LEVEL") } : {}) };
    else problems.push(`classifier unavailable (${resolved.problem}); the writer chain will triage instead.`);
  }

  // The repairer can be split from the writer chain too (Gemini repairing a
  // DeepSeek draft, say). Unset keeps the writer chain.
  let repairProvider: ProviderSpec | undefined;
  const repairKind = env("GENERATION_REPAIR_PROVIDER")?.toLowerCase();
  if (repairKind) {
    const resolved = specFor(repairKind, production);
    if (resolved.spec) repairProvider = resolved.spec;
    else problems.push(`repairer unavailable (${resolved.problem}); the writer chain will repair instead.`);
  }

  return {
    enabled: flag("GENERATION_ENABLED", false),
    guestEnabled: flag("GUEST_GENERATION_ENABLED", true),
    followupsEnabled: flag("FOLLOWUPS_ENABLED", false),
    providers,
    reviewProvider,
    classifierProvider,
    repairProvider,
    configurationProblem: problems.length ? problems.join(" ") : undefined,
    timeoutMs: positiveInt("GENERATION_TIMEOUT_MS", 30_000),
    limits: {
      sessionPerDay: positiveInt("GENERATION_LIMIT_SESSION_DAY", 10),
      ipPerDay: positiveInt("GENERATION_LIMIT_IP_DAY", 30),
      globalPerDay: positiveInt("GENERATION_LIMIT_GLOBAL_DAY", 400),
    },
  };
}
