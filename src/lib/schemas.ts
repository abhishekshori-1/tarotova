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
});

export const verifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code."),
});
