import type { EmailProvider, SendCodeParams, SendResult } from "./provider";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend delivery using fetch directly, without an SDK dependency.
 * Awaits the send within the request per section 6 ("do not rely on
 * unfinished work after a serverless response") and uses one idempotency
 * key per challenge generation per Resend's idempotency guidance.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async sendVerificationCode(params: SendCodeParams): Promise<SendResult> {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": params.idempotencyKey,
          "User-Agent": "Tarotova/0.1",
        },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          from: this.from,
          to: params.to,
          subject: "Your Tarotova reading code",
          text: `Your verification code is ${params.code}. It expires in 10 minutes.\nIf you didn't request this, you can ignore this email.`,
        }),
      });

      if (!res.ok) {
        return { status: "failed", reason: `resend_http_${res.status}` };
      }
      const body: unknown = await res.json();
      if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !body.id.trim()) {
        // A successful HTTP response without a message id cannot confirm
        // acceptance. Keep the challenge usable in case delivery occurred.
        return { status: "failed", reason: "resend_invalid_response" };
      }
      return { status: "accepted", providerMessageId: body.id };
    } catch {
      // A network/timeout failure here means acceptance is uncertain, not a
      // definite rejection (PLAN.md section 6) — callers must treat this the
      // same as "failed" only for the purpose of a controlled retry, and must
      // not discard the still-usable pending code.
      return { status: "failed", reason: "network_error_or_timeout" };
    }
  }
}
