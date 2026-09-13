import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { requestOtp } from "@/server/readingService";
import { privateJson, handleServiceError, getClientIp } from "@/server/http";
import { verifyTurnstile } from "@/server/turnstile";
import { otpSchema } from "@/lib/schemas";
import { z } from "zod";
import { randomId } from "@/server/ids";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = randomId();
  const startedAt = Date.now();
  let stage = "migration";
  let readingId: string | undefined;
  const context = { requestId, region: process.env.VERCEL_REGION ?? "local" };
  console.info("[otp_request]", { ...context, event: "started" });
  function finish(response: ReturnType<typeof privateJson>) {
    response.headers.set("X-Request-Id", requestId);
    console.info("[otp_request]", {
      ...context, readingId, event: "finished", stage, status: response.status,
      retryAfter: response.headers.get("Retry-After"), durationMs: Date.now() - startedAt,
    });
    return response;
  }
  try {
    await ensureMigrated();
    const { id } = await params;
    readingId = id;
    stage = "session";
    const session = await resolveSession();
    stage = "validation";
    const body = otpSchema.parse(await req.json());
    const ip = getClientIp(req);

    stage = "turnstile";
    const botOk = await verifyTurnstile(body.turnstileToken, ip);
    if (!botOk) return finish(privateJson({ error: "bot_check_failed" }, { status: 400 }));

    stage = "request_otp";
    const result = await requestOtp(id, session.id, body.revision, body.email, ip);
    stage = "delivery_result";
    if (result.sendStatus === "failed") {
      return finish(privateJson({ error: "email_send_failed", sendStatus: result.sendStatus }, { status: 502 }));
    }
    return finish(privateJson(result, { status: result.sendStatus === "pending" ? 202 : 200 }));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return finish(privateJson({ error: "invalid_request" }, { status: 400 }));
    return finish(handleServiceError(err));
  }
}
