import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { getResult } from "@/server/readingService";
import { privateJson, handleServiceError } from "@/server/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  ensureMigrated();
  try {
    const { id } = await params;
    const session = await resolveSession();
    return privateJson(getResult(id, session.id));
  } catch (err) {
    return handleServiceError(err);
  }
}
