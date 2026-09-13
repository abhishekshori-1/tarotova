import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { requestOtp } from "@/server/readingService";
import { privateJson, handleServiceError, getClientIp } from "@/server/http";
import { verifyTurnstile } from "@/server/turnstile";
import { otpSchema } from "@/lib/schemas";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureMigrated();
  try {
    const { id } = await params;
    const session = await resolveSession();
    const body = otpSchema.parse(await req.json());
    const ip = getClientIp(req);

    const botOk = await verifyTurnstile(body.turnstileToken, ip);
    if (!botOk) return privateJson({ error: "bot_check_failed" }, { status: 400 });

    const result = await requestOtp(id, session.id, body.revision, body.email, ip);
    return privateJson(result);
  } catch (err) {
    if (err instanceof z.ZodError) return privateJson({ error: "invalid_request", issues: err.issues }, { status: 400 });
    return handleServiceError(err);
  }
}
