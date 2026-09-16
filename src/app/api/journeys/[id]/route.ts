import { z } from "zod";
import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { advanceJourney, getJourney } from "@/server/journeys";
import { privateJson, handleServiceError } from "@/server/http";
const bodySchema = z.object({ revision: z.number().int().nonnegative(), submissionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/), destination: z.enum(["frame", "explore", "reflect", "complete"]) }).strict();
type Context = { params: Promise<{ id: string }> };
export async function GET(_req: Request, { params }: Context) {
  await ensureMigrated();
  try { return privateJson(await getJourney((await params).id, (await resolveSession()).id)); }
  catch (err) { return handleServiceError(err); }
}
export async function PATCH(req: Request, { params }: Context) {
  await ensureMigrated();
  try {
    const body = bodySchema.parse(await req.json());
    return privateJson(await advanceJourney((await params).id, (await resolveSession()).id, body.revision, body.submissionId, body.destination));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return privateJson({ error: "invalid_request" }, { status: 400 });
    return handleServiceError(err);
  }
}
