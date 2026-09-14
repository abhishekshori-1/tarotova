/**
 * Release B flags and budgets (docs/REVIEW-V2.md finding 2). Everything is
 * read at call time so a redeploy with a changed variable takes effect
 * without code changes; nothing here is inlined at build time.
 *
 * - GENERATION_ENABLED: master flag; off means the result carries no
 *   personalized section at all (Release A behaviour).
 * - GUEST_GENERATION_ENABLED: the guest-only kill switch — verified sessions
 *   keep generating while anonymous spend is paused.
 * - GENERATION_PROVIDER: an ordered, comma-separated chain. "gemini,anthropic"
 *   (the production default) prefers Gemini and falls back to Anthropic when
 *   Gemini fails; "stub" is the free offline provider for dev/tests. An entry
 *   whose key is missing is skipped and named in `configurationProblem`;
 *   production never falls back to the stub — with no usable provider the
 *   answer is reported "unavailable" and logged, never silently faked.
 */
export const GENERATION_MAX_ATTEMPTS = 2; // paid passes through the chain per reading, ever
export const GENERATION_LEASE_MS = 90_000; // a request holds the row this long
export const GENERATION_KIND = "interpretation";
/** Don't start another attempt this late in the request; the route's maxDuration is 60 s. */
export const GENERATION_REQUEST_BUDGET_MS = 40_000;

export type ProviderKind = "gemini" | "anthropic" | "stub";

export interface ProviderSpec {
  kind: ProviderKind;
  apiKey?: string;
  /** Anthropic only: required by the API when the key is organization-level rather than workspace-scoped. */
  workspaceId?: string;
  models: { answer: string; classifier: string };
}

export interface GenerationLimits {
  sessionPerDay: number;
  ipPerDay: number;
  globalPerDay: number;
}

export interface GenerationConfig {
  enabled: boolean;
  guestEnabled: boolean;
  /** Usable providers, in preference order; empty means nothing can generate. */
  providers: ProviderSpec[];
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

export function getGenerationConfig(): GenerationConfig {
  const production = process.env.NODE_ENV === "production";
  const requested = (env("GENERATION_PROVIDER") ?? (production ? "gemini,anthropic" : "stub"))
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const providers: ProviderSpec[] = [];
  const problems: string[] = [];
  for (const kind of requested) {
    if (kind === "gemini") {
      const apiKey = env("GEMINI_API_KEY");
      if (!apiKey) problems.push("gemini skipped: GEMINI_API_KEY is not set.");
      else providers.push({ kind, apiKey, models: { answer: env("GEMINI_MODEL") ?? "gemini-2.5-pro", classifier: env("GEMINI_CLASSIFIER_MODEL") ?? "gemini-2.5-flash" } });
    } else if (kind === "anthropic") {
      const apiKey = env("ANTHROPIC_API_KEY");
      if (!apiKey) problems.push("anthropic skipped: ANTHROPIC_API_KEY is not set.");
      else {
        providers.push({
          kind,
          apiKey,
          workspaceId: env("ANTHROPIC_WORKSPACE_ID"),
          models: { answer: env("ANTHROPIC_MODEL", "GENERATION_MODEL") ?? "claude-sonnet-5", classifier: env("ANTHROPIC_CLASSIFIER_MODEL", "CLASSIFIER_MODEL") ?? "claude-haiku-4-5-20251001" },
        });
      }
    } else if (kind === "stub") {
      if (production) problems.push("stub skipped: not available in production.");
      else providers.push({ kind, models: { answer: "stub-answer", classifier: "stub-classifier" } });
    } else {
      problems.push(`unknown provider ${JSON.stringify(kind)} skipped.`);
    }
  }
  if (providers.length === 0 && problems.length === 0) problems.push("GENERATION_PROVIDER is empty.");

  return {
    enabled: flag("GENERATION_ENABLED", false),
    guestEnabled: flag("GUEST_GENERATION_ENABLED", true),
    providers,
    configurationProblem: problems.length ? problems.join(" ") : undefined,
    timeoutMs: positiveInt("GENERATION_TIMEOUT_MS", 20_000),
    limits: {
      sessionPerDay: positiveInt("GENERATION_LIMIT_SESSION_DAY", 10),
      ipPerDay: positiveInt("GENERATION_LIMIT_IP_DAY", 30),
      globalPerDay: positiveInt("GENERATION_LIMIT_GLOBAL_DAY", 400),
    },
  };
}
