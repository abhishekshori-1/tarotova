import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { listFollowups, requestFollowup } from "@/server/generation/followups";
import { GENERATION_REQUEST_DEADLINE_MS } from "@/server/generation/config";
import { getClientIp, privateJson } from "@/server/http";
import { tracedRequest } from "@/server/requestLog";
import { followupSchema } from "@/lib/schemas";

// One follow-up pipeline (triage, write, review, one repair, review) must
// finish inside the function's limit; nothing continues after the response.
export const maxDuration = 60;

/** Owned, unexpired access: the conversation so far and whether a new turn can be sent. No paid work. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureMigrated();
  return tracedRequest("[followups]", async (trace) => {
    const { id } = await params;
    trace.subject(id);
    const session = await resolveSession();
    return privateJson(await listFollowups(id, session.id));
  });
}

/**
 * Accepts one turn. Idempotent on `submissionId`: a repeat with the same
 * text returns or resumes the stored turn; a different text conflicts.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const deadlineAt = Date.now() + GENERATION_REQUEST_DEADLINE_MS;
  await ensureMigrated();
  return tracedRequest("[followups]", async (trace) => {
    const { id } = await params;
    trace.subject(id);
    trace.stage("session");
    const session = await resolveSession();
    const body = followupSchema.parse(await req.json());
    trace.stage("turn");
    const view = await requestFollowup(id, session.id, getClientIp(req), body.submissionId, body.text, { deadlineAt });
    const pending = view.turns.some((t) => t.submissionId === body.submissionId && t.status === "pending");
    return privateJson(view, { status: pending ? 202 : 200 });
  });
}
