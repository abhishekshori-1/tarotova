import type { EmailProvider, SendCodeParams, SendResult } from "./provider";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Real path for PLAN.md section 5/6/8, unused until RESEND_API_KEY and a
 * verified sending domain exist. Uses fetch directly rather than the
 * `resend` package to avoid an unused dependency while EMAIL_PROVIDER=console.
 * Awaits the send within the request per section 6 ("do not rely on
 * unfinished work after a serverless response") and uses one idempotency
 * key per challenge generation per Resend's idempotency guidance.
 */
export class ResendEmailProvider implements EmailProvider {
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
        },
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
      const body = (await res.json()) as { id?: string };
      return { status: "accepted", providerMessageId: body.id ?? "unknown" };
    } catch {
      // A network/timeout failure here means acceptance is uncertain, not a
      // definite rejection (PLAN.md section 6) — callers must treat this the
      // same as "failed" only for the purpose of a controlled retry, and must
      // not discard the still-usable pending code.
      return { status: "failed", reason: "network_error_or_timeout" };
    }
  }
}
