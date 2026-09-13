import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { updateContext } from "@/server/readingService";
import { privateJson, handleServiceError } from "@/server/http";
import { contextSchema } from "@/lib/schemas";
import { z } from "zod";

/** Edits the draft's question; frozen once the draw is locked. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureMigrated();
  try {
    const { id } = await params;
    const session = await resolveSession();
    const body = contextSchema.parse(await req.json());
    return privateJson(await updateContext(id, session.id, body.revision, body.question));
  } catch (err) {
    if (err instanceof z.ZodError) return privateJson({ error: "invalid_request", issues: err.issues }, { status: 400 });
    return handleServiceError(err);
  }
}
