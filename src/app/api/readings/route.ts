import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { createReading } from "@/server/readingService";
import { privateJson, handleServiceError } from "@/server/http";
import { checkAndIncrement } from "@/server/rateLimit";
import { getClientIp } from "@/server/http";

export async function POST(req: Request) {
  await ensureMigrated();
  try {
    const ip = getClientIp(req);
    const ipLimit = await checkAndIncrement(`ip:${ip}`, { action: "reading_create_hour", windowMs: 60 * 60 * 1000, limit: 30 });
    if (!ipLimit.allowed) {
      const res = privateJson({ error: "rate_limited" }, { status: 429 });
      res.headers.set("Retry-After", String(Math.ceil(ipLimit.retryAfterMs / 1000)));
      return res;
    }

    const session = await resolveSession();
    const sessionLimit = await checkAndIncrement(`session:${session.id}`, {
      action: "reading_create_hour",
      windowMs: 60 * 60 * 1000,
      limit: 20,
    });
    if (!sessionLimit.allowed) {
      const res = privateJson({ error: "rate_limited" }, { status: 429 });
      res.headers.set("Retry-After", String(Math.ceil(sessionLimit.retryAfterMs / 1000)));
      return res;
    }

    const status = await createReading(session.id);
    return privateJson(status, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
