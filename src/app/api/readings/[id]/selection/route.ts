import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { getStatus, updateSelection } from "@/server/readingService";
import { getClientIp, privateJson, handleServiceError } from "@/server/http";
import { verifyTurnstile } from "@/server/turnstile";
import { selectionSchema } from "@/lib/schemas";
import { z } from "zod";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureMigrated();
  try {
    const { id } = await params;
    const session = await resolveSession();
    const body = selectionSchema.parse(await req.json());
    if (body.lock) {
      // A guest lock issues the free grant that unlocks paid generation, so
      // while generation is enabled it carries the same bot check as
      // requesting a code; a verified session already passed it
      // (docs/REVIEW-V2.md finding 2). With generation off there is nothing
      // to protect and the reveal is Release A's. Fails closed in production
      // when the check is required but unconfigured.
      const status = await getStatus(id, session.id);
      if (status.botCheckOnReveal && !(await verifyTurnstile(body.turnstileToken, getClientIp(req)))) {
        return privateJson({ error: "bot_check_failed" }, { status: 400 });
      }
    }
    return privateJson(await updateSelection(id, session.id, body.revision, body.slots, body.lock, body.focus));
  } catch (err) {
    if (err instanceof z.ZodError) return privateJson({ error: "invalid_request", issues: err.issues }, { status: 400 });
    return handleServiceError(err);
  }
}
