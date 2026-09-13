const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * PLAN.md section 5/6 bot protection. No Turnstile account exists yet
 * (section 13), so with no secret configured this logs a warning and lets
 * the request through — a deliberate local-dev-only stand-in, not a
 * production posture. Wire TURNSTILE_SECRET_KEY before any public deploy.
 */
export async function verifyTurnstile(token: string | undefined, remoteIp: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("[dev-only] TURNSTILE_SECRET_KEY not set — skipping bot-token verification.");
    return true;
  }
  if (!token) return false;

  try {
    const res = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: remoteIp }),
    });
    const body = (await res.json()) as { success: boolean };
    return body.success === true;
  } catch {
    return false;
  }
}
