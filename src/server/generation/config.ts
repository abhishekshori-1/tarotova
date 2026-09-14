/**
 * Release B flags and budgets (docs/REVIEW-V2.md finding 2). Everything is
 * read at call time so a redeploy with a changed variable takes effect
 * without code changes; nothing here is inlined at build time.
 *
 * - GENERATION_ENABLED: master flag; off means the result carries no
 *   personalized section at all (Release A behaviour).
 * - GUEST_GENERATION_ENABLED: the guest-only kill switch — verified sessions
 *   keep generating while anonymous spend is paused.
 * - GENERATION_PROVIDER: "anthropic" (production) or "stub" (dev/tests).
 *   Production never falls back to the stub: a missing key is reported as
 *   "unavailable" and logged, never silently faked.
 */
export const GENERATION_MAX_ATTEMPTS = 2; // paid calls per reading, ever
export const GENERATION_LEASE_MS = 90_000; // a request holds the row this long
export const GENERATION_KIND = "interpretation";

export interface GenerationLimits {
  sessionPerDay: number;
  ipPerDay: number;
  globalPerDay: number;
}

export interface GenerationConfig {
  enabled: boolean;
  guestEnabled: boolean;
  provider: "anthropic" | "stub" | null;
  /** Why `provider` is null, for the log line. */
  configurationProblem?: string;
  apiKey?: string;
  model: string;
  classifierModel: string;
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

export function getGenerationConfig(): GenerationConfig {
  const production = process.env.NODE_ENV === "production";
  const requested = process.env.GENERATION_PROVIDER?.trim() || (production ? undefined : "stub");
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;

  let provider: GenerationConfig["provider"] = null;
  let configurationProblem: string | undefined;
  if (requested === "anthropic") {
    if (apiKey) provider = "anthropic";
    else configurationProblem = "ANTHROPIC_API_KEY is required for the anthropic provider.";
  } else if (requested === "stub") {
    if (production) configurationProblem = "The stub provider is not available in production.";
    else provider = "stub";
  } else {
    configurationProblem = `GENERATION_PROVIDER must be "anthropic" (or "stub" outside production); got ${JSON.stringify(requested ?? "")}.`;
  }

  return {
    enabled: flag("GENERATION_ENABLED", false),
    guestEnabled: flag("GUEST_GENERATION_ENABLED", true),
    provider,
    configurationProblem,
    apiKey,
    model: process.env.GENERATION_MODEL?.trim() || "claude-sonnet-5",
    classifierModel: process.env.CLASSIFIER_MODEL?.trim() || "claude-haiku-4-5-20251001",
    timeoutMs: positiveInt("GENERATION_TIMEOUT_MS", 20_000),
    limits: {
      sessionPerDay: positiveInt("GENERATION_LIMIT_SESSION_DAY", 10),
      ipPerDay: positiveInt("GENERATION_LIMIT_IP_DAY", 30),
      globalPerDay: positiveInt("GENERATION_LIMIT_GLOBAL_DAY", 400),
    },
  };
}
