import { randomId } from "../ids";
import type { EmailProvider, SendCodeParams, SendResult } from "./provider";

/**
 * Local-dev stand-in for Resend (PLAN.md section 5/8) — no email account
 * exists yet. Logs the code to the server terminal instead of delivering
 * it. `lastCodeFor` lets non-production routes echo the code back so the
 * confirm screen is testable without a real inbox; never used in a
 * production build (guarded at the call site in the otp route).
 */
class ConsoleEmailProvider implements EmailProvider {
  private lastCodes = new Map<string, string>();

  async sendVerificationCode(params: SendCodeParams): Promise<SendResult> {
    this.lastCodes.set(params.readingId, params.code);
    console.log(
      `[dev-email] reading=${params.readingId} to=${params.to} idempotencyKey=${params.idempotencyKey}\n` +
        `[dev-email] verification code: ${params.code} (expires in 10 minutes)`,
    );
    return { status: "accepted", providerMessageId: `dev_${randomId(8)}` };
  }

  lastCodeFor(readingId: string): string | undefined {
    return this.lastCodes.get(readingId);
  }
}

export const consoleEmailProvider = new ConsoleEmailProvider();
