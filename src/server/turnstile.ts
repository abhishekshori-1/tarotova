const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export class BotCheckConfigurationError extends Error {}

/**
 * PLAN.md section 5/6 bot protection. Without a secret this passes only
 * outside production (local dev needs no Cloudflare account); production
 * fails closed so a missing key is a visible 503, not a silently skipped
 * check.
 */
export async function verifyTurnstile(token: string | undefined, remoteIp: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new BotCheckConfigurationError("TURNSTILE_SECRET_KEY is required in production.");
    }
    console.warn("[dev-only] TURNSTILE_SECRET_KEY not set — skipping bot-token verification.");
    return true;
  }
  if (!token) return false;

  try {
    const res = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: remoteIp }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    return false;
  }
}
