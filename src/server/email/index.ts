import type { EmailProvider } from "./provider";
import { consoleEmailProvider } from "./console-provider";
import { ResendEmailProvider } from "./resend-provider";

export function getEmailProvider(): EmailProvider {
  if (process.env.EMAIL_PROVIDER === "resend" && process.env.RESEND_API_KEY) {
    return new ResendEmailProvider(process.env.RESEND_API_KEY, process.env.EMAIL_FROM ?? "Tarotova <onboarding@tarotova.example>");
  }
  return consoleEmailProvider;
}

export { consoleEmailProvider };
