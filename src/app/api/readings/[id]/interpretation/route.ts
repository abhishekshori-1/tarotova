import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { requestInterpretation } from "@/server/generation/service";
import { getClientIp, privateJson } from "@/server/http";
import { tracedRequest } from "@/server/requestLog";

// Two bounded provider attempts plus the classifier must fit inside the
// function's own limit; nothing continues after the response is sent.
export const maxDuration = 60;

/**
 * Idempotent: the first call claims the generation, later calls (other tabs,
 * a retry after a lost response) report its state. Authorized by the
 * reading's access grant, exactly like the result itself.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureMigrated();
  return tracedRequest("[interpretation]", async (trace) => {
    const { id } = await params;
    trace.subject(id);
    trace.stage("session");
    const session = await resolveSession();
    trace.stage("generate");
    const view = await requestInterpretation(id, session.id, getClientIp(req));
    return privateJson(view, { status: view.status === "pending" ? 202 : 200 });
  });
}
