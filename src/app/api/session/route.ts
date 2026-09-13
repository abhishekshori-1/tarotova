import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { getSessionVerification } from "@/server/sessionVerification";
import { privateJson, handleServiceError } from "@/server/http";

/** This browser's verification state — never the email itself, only a mask. */
export async function GET() {
  await ensureMigrated();
  try {
    const session = await resolveSession();
    return privateJson(await getSessionVerification(session.id));
  } catch (err) {
    return handleServiceError(err);
  }
}
