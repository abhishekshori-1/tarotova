import type { EmailProvider } from "./provider";
import { consoleEmailProvider } from "./console-provider";
import { ResendEmailProvider } from "./resend-provider";

export class EmailConfigurationError extends Error {}

export function getEmailProvider(): EmailProvider {
  const production = process.env.NODE_ENV === "production";
  const provider = process.env.EMAIL_PROVIDER?.trim() || (production ? undefined : "console");
  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    if (!apiKey) throw new EmailConfigurationError("RESEND_API_KEY is required for Resend.");
    if (!from) throw new EmailConfigurationError("EMAIL_FROM is required for Resend.");
    return new ResendEmailProvider(apiKey, from);
  }
  if (provider === "console" && !production) return consoleEmailProvider;
  throw new EmailConfigurationError("Set EMAIL_PROVIDER=resend in production; console is only available in development/tests.");
}

export { consoleEmailProvider };
