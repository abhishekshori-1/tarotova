import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { reshuffle } from "@/server/readingService";
import { privateJson, handleServiceError } from "@/server/http";
import { z } from "zod";

const bodySchema = z.object({ revision: z.number().int().min(0) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureMigrated();
  try {
    const { id } = await params;
    const session = await resolveSession();
    const body = bodySchema.parse(await req.json());
    return privateJson(await reshuffle(id, session.id, body.revision));
  } catch (err) {
    if (err instanceof z.ZodError) return privateJson({ error: "invalid_request", issues: err.issues }, { status: 400 });
    return handleServiceError(err);
  }
}
