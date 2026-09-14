import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { requestSessionCode } from "@/server/sessionVerification";
import { privateJson, getClientIp } from "@/server/http";
import { verifyTurnstile } from "@/server/turnstile";
import { tracedRequest } from "@/server/requestLog";
import { sessionCodeSchema } from "@/lib/schemas";

/** Sends a session-continuation code (docs/ACCESS-FLOW.md section 6). */
export function POST(req: Request) {
  return tracedRequest("[session_verification]", async (trace) => {
    trace.stage("migration");
    await ensureMigrated();
    trace.stage("session");
    const session = await resolveSession();
    trace.subject(session.id);
    trace.stage("validation");
    const body = sessionCodeSchema.parse(await req.json());
    const ip = getClientIp(req);

    trace.stage("turnstile");
    if (!(await verifyTurnstile(body.turnstileToken, ip))) return privateJson({ error: "bot_check_failed" }, { status: 400 });

    trace.stage("request_code");
    const result = await requestSessionCode(session.id, body.email, ip);
    trace.stage("delivery_result");
    if (result.sendStatus === "failed") return privateJson({ error: "email_send_failed", sendStatus: result.sendStatus }, { status: 502 });
    return privateJson(result, { status: result.sendStatus === "pending" ? 202 : 200 });
  });
}
