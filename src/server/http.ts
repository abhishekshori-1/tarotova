import { NextResponse } from "next/server";
import { AccessRequiredError, ConflictError, OwnershipError, ValidationError, RateLimitedError } from "./errors";
import { EmailConfigurationError } from "./email";
import { BotCheckConfigurationError } from "./turnstile";

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "127.0.0.1";
}

/** All private API responses stay uncached (PLAN.md section 7). */
export function privateJson(body: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export function handleServiceError(err: unknown): NextResponse {
  if (err instanceof EmailConfigurationError) {
    console.error("[email_configuration]", { reason: err.message });
    return privateJson({ error: "email_not_configured" }, { status: 503 });
  }
  if (err instanceof BotCheckConfigurationError) {
    console.error("[bot_check_configuration]", { reason: err.message });
    return privateJson({ error: "bot_check_not_configured" }, { status: 503 });
  }
  if (err instanceof OwnershipError) {
    return privateJson({ error: "not_found" }, { status: 404 });
  }
  if (err instanceof AccessRequiredError) {
    return privateJson({ error: "verification_required" }, { status: 403 });
  }
  if (err instanceof ConflictError) {
    return privateJson({ error: "revision_conflict", currentRevision: err.currentRevision }, { status: 409 });
  }
  if (err instanceof RateLimitedError) {
    const res = privateJson({ error: "rate_limited" }, { status: 429 });
    res.headers.set("Retry-After", String(Math.ceil(err.retryAfterMs / 1000)));
    return res;
  }
  if (err instanceof ValidationError) {
    return privateJson({ error: err.message || "invalid_request" }, { status: 400 });
  }
  console.error(err);
  return privateJson({ error: "internal_error" }, { status: 500 });
}
