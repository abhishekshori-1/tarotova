import { timingSafeEqual } from "node:crypto";
import { ensureMigrated } from "@/server/db/migrate";
import { deleteExpired } from "@/server/cleanup";
import { privateJson } from "@/server/http";

/**
 * Retention job (PLAN.md section 7). Vercel Cron calls this with
 * `Authorization: Bearer $CRON_SECRET`; any other scheduler can do the same.
 * Without a configured secret the route refuses every call.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice("Bearer ".length));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return privateJson({ error: "not_found" }, { status: 404 });
  await ensureMigrated();
  const startedAt = Date.now();
  try {
    const deleted = await deleteExpired();
    console.info("[cleanup]", { ...deleted, durationMs: Date.now() - startedAt });
    return privateJson({ ok: true, deleted });
  } catch (err) {
    console.error("[cleanup]", { error: err instanceof Error ? err.message : "unknown", durationMs: Date.now() - startedAt });
    return privateJson({ error: "cleanup_failed" }, { status: 500 });
  }
}

export const POST = GET;
