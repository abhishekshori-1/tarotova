import { z } from "zod";
import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { createJourney } from "@/server/journeys";
import { getClientIp, privateJson, handleServiceError } from "@/server/http";
import { getJourneyEntryView } from "@/server/journeyEntry";
const bodySchema = z.object({ submissionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/), slug: z.string().max(80), question: z.string().trim().min(1).max(500) }).strict();
export async function GET() {
  try { return privateJson(await getJourneyEntryView()); }
  catch (err) { return handleServiceError(err); }
}
export async function POST(req: Request) {
  await ensureMigrated();
  try {
    const body = bodySchema.parse(await req.json());
    const session = await resolveSession();
    return privateJson(await createJourney(session.id, getClientIp(req), body.submissionId, body.slug, body.question), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return privateJson({ error: "invalid_request" }, { status: 400 });
    return handleServiceError(err);
  }
}
