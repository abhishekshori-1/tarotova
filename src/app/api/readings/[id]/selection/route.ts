import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { updateSelection } from "@/server/readingService";
import { privateJson, handleServiceError } from "@/server/http";
import { selectionSchema } from "@/lib/schemas";
import { z } from "zod";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  ensureMigrated();
  try {
    const { id } = await params;
    const session = await resolveSession();
    const body = selectionSchema.parse(await req.json());
    return privateJson(updateSelection(id, session.id, body.revision, body.slots, body.lock, body.focus));
  } catch (err) {
    if (err instanceof z.ZodError) return privateJson({ error: "invalid_request", issues: err.issues }, { status: 400 });
    return handleServiceError(err);
  }
}
