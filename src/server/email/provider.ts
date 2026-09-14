export interface SendCodeParams {
  to: string;
  code: string;
  /** The reading or browser session the code belongs to (for dev tooling; never sent to the recipient). */
  subjectId: string;
  idempotencyKey: string;
}

export type SendResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "failed"; reason: string };

export interface EmailProvider {
  readonly name: "console" | "resend";
  sendVerificationCode(params: SendCodeParams): Promise<SendResult>;
}
