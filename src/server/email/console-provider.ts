import { randomId } from "../ids";
import type { EmailProvider, SendCodeParams, SendResult } from "./provider";

/**
 * Local-dev stand-in for Resend (PLAN.md section 5/8). Logs the code to the
 * terminal instead of delivering it. `lastCodeFor` makes local integration
 * tests possible without a real inbox. getEmailProvider rejects this
 * provider in production; the service also guards its dev-only code echo.
 */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
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
