export interface SendCodeParams {
  to: string;
  code: string;
  readingId: string;
  idempotencyKey: string;
}

export type SendResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "failed"; reason: string };

export interface EmailProvider {
  readonly name: "console" | "resend";
  sendVerificationCode(params: SendCodeParams): Promise<SendResult>;
}
