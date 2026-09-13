export class ConflictError extends Error {
  constructor(public currentRevision: number) {
    super("revision_conflict");
  }
}
export class OwnershipError extends Error {
  constructor() {
    super("not_found");
  }
}
/** The caller owns the reading but this browser session holds no access grant for it yet. */
export class AccessRequiredError extends Error {
  constructor() {
    super("verification_required");
  }
}
export class ValidationError extends Error {}
export class RateLimitedError extends Error {
  constructor(public retryAfterMs: number) {
    super("rate_limited");
  }
}
