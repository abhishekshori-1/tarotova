import { ensureMigrated } from "@/server/db/migrate";
import { db } from "@/server/db/client";
import { deliveryEvents, suppressedEmails } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { hashEmailForLookup } from "@/server/emailHash";
import { NextResponse } from "next/server";

/**
 * Stub for Resend's delivery/bounce webhook (PLAN.md section 5/6/7). No
 * Resend account or signing secret exists yet, so signature verification
 * below is a documented no-op — do not accept this endpoint's input as
 * trusted until real signature verification (per Resend's webhook docs) is
 * wired in before any public deploy.
 */
export async function POST(req: Request) {
  await ensureMigrated();

  // TODO before production: verify the Svix/Resend webhook signature here.
  // Left unimplemented because no signing secret exists yet (PLAN.md section 13).

  const body = (await req.json()) as {
    type?: string;
    data?: { email_id?: string; to?: string[]; bounce?: { type?: string } };
  };

  const providerEventId = req.headers.get("svix-id") ?? randomId();
  const messageId = body.data?.email_id ?? "unknown";
  const status = body.type ?? "unknown";

  // Atomic dedup on the unique provider event id, instead of check-then-insert.
  await db
    .insert(deliveryEvents)
    .values({ id: randomId(), providerEventId, messageId, status, occurredAt: Date.now(), createdAt: Date.now() })
    .onConflictDoNothing({ target: deliveryEvents.providerEventId });

  const isHardBounce = body.type === "email.bounced" && body.data?.bounce?.type === "Permanent";
  const isComplaint = body.type === "email.complained";
  if ((isHardBounce || isComplaint) && body.data?.to?.[0]) {
    const normalized = body.data.to[0].trim().toLowerCase();
    const hash = hashEmailForLookup(normalized);
    await db
      .insert(suppressedEmails)
      .values({
        id: randomId(),
        normalizedLookupHash: hash,
        reason: isHardBounce ? "hard_bounce" : "complaint",
        firstSuppressedAt: Date.now(),
        sourceEventId: providerEventId,
      })
      .onConflictDoNothing({ target: suppressedEmails.normalizedLookupHash });
  }

  return NextResponse.json({ received: true });
}
