import { ensureMigrated } from "@/server/db/migrate";
import { resolveSession } from "@/server/session";
import { verifyOtp } from "@/server/readingService";
import { privateJson, handleServiceError } from "@/server/http";
import { verifySchema } from "@/lib/schemas";
import { z } from "zod";

// Generic error messages only (PLAN.md section 6) — the reason codes below
// are for the UI to pick the right built state (expired/invalid/exhausted),
// not to leak account-existence information.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  ensureMigrated();
  try {
    const { id } = await params;
    const session = await resolveSession();
    const body = verifySchema.parse(await req.json());
    const result = verifyOtp(id, session.id, body.code);
    if (!result.ok) {
      return privateJson({ error: "verification_failed", reason: result.reason }, { status: 400 });
    }
    return privateJson({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return privateJson({ error: "invalid_request", issues: err.issues }, { status: 400 });
    return handleServiceError(err);
  }
}
