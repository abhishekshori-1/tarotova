import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { confirmSessionCode } from "@/server/sessionVerification";
import { privateJson } from "@/server/http";
import { tracedRequest } from "@/server/requestLog";
import { verifySchema } from "@/lib/schemas";

// Generic reason codes only (PLAN.md section 6): enough for the UI to pick
// the right state, never enough to learn anything about an address.
export function POST(req: Request) {
  return tracedRequest("[session_confirm]", async (trace) => {
    trace.stage("migration");
    await ensureMigrated();
    trace.stage("session");
    const session = await resolveSession();
    trace.subject(session.id);
    trace.stage("validation");
    const body = verifySchema.parse(await req.json());
    trace.stage("confirm");
    const result = await confirmSessionCode(session.id, body.code);
    if (!result.ok) return privateJson({ error: "verification_failed", reason: result.reason }, { status: 400 });
    return privateJson({ ok: true });
  });
}
