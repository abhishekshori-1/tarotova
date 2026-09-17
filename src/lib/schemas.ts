import { z } from "zod";
import { FOCUSES } from "@/content/types";

export const focusSchema = z.enum(FOCUSES);

export const questionSchema = z.string().trim().max(500, "Keep your question under 500 characters.");

export const createReadingSchema = z.object({ focus: focusSchema.optional(), question: questionSchema.optional() });

export const contextSchema = z.object({
  revision: z.number().int().min(0),
  question: questionSchema.nullable(),
});

export const sessionCodeSchema = z.object({
  email: z.string().trim().min(3).max(254).email(),
  turnstileToken: z.string().optional(),
});

export const selectionSchema = z.object({
  revision: z.number().int().min(0),
  slots: z
    .array(z.number().int().min(0).max(21))
    .max(3)
    .refine((s) => new Set(s).size === s.length, "Slots must be distinct."),
  lock: z.boolean().default(false),
  focus: focusSchema.optional(),
  /** Required by the server for a guest lock when Turnstile is configured (docs/REVIEW-V2.md finding 2). */
  turnstileToken: z.string().optional(),
});

export const verifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const FOLLOWUP_MAX_LENGTH = 500;

/** One follow-up turn: the client's idempotency id and the immutable text (docs/RELEASE-C.md section 4). */
export const followupSchema = z.object({
  submissionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "submission id"),
  text: z.string().trim().min(1, "Write something first.").max(FOLLOWUP_MAX_LENGTH, "Keep it under 500 characters."),
});
