import { randomBytes } from "node:crypto";

/** URL-safe, high-entropy opaque id (base64url of `bytes` random bytes). */
export function randomId(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}
