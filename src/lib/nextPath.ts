/**
 * Only same-origin paths may be used as a post-verification destination
 * (docs/ACCESS-FLOW.md section 6) — never a full URL or a protocol-relative
 * `//host` path.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
}

export function verifyHref(next: string) {
  return `/verify?next=${encodeURIComponent(next)}`;
}
