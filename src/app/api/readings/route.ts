import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { createReading } from "@/server/readingService";
import { privateJson, handleServiceError } from "@/server/http";
import { checkAndIncrement } from "@/server/rateLimit";
import { getClientIp } from "@/server/http";
import { createReadingSchema } from "@/lib/schemas";
import { z } from "zod";

/** An empty body is a general reading; a JSON body may carry an initial focus. */
async function parseBody(req: Request) {
  const text = await req.text();
  if (!text.trim()) return {};
  return createReadingSchema.parse(JSON.parse(text));
}

export async function POST(req: Request) {
  await ensureMigrated();
  try {
    const body = await parseBody(req);
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

    const status = await createReading(session.id, body.focus, body.question);
    return privateJson(status, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return privateJson({ error: "invalid_request" }, { status: 400 });
    return handleServiceError(err);
  }
}
