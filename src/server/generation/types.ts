import type { SafetyCategory, SafetyResponse } from "@/content/safety";
import type { Position } from "@/content/types";

/** The validated structured answer (eval/RUBRIC.md "What the answer is"). */
export interface InterpretationOutput {
  perspective: string;
  cards: { position: Position; relevance: string }[];
  reflection: string;
  beyondSpread: string | null;
}

/**
 * What the client sees. Every state is renderable without another request
 * except `idle` (ask for it) and `pending` (poll).
 */
export type InterpretationView =
  | { status: "disabled" }
  | { status: "not_applicable" }
  | { status: "idle" }
  | { status: "pending" }
  | { status: "unavailable"; reason: "not_configured" | "guest_paused" | "busy"; retryAfterSeconds?: number }
  | { status: "succeeded"; answer: InterpretationOutput; model: string; promptVersion: string }
  | { status: "refused"; category: SafetyCategory; response: SafetyResponse }
  | { status: "failed"; reason: string; retryable: boolean };

export interface InterpretationInput {
  question: string;
  focusLabel: string;
  cards: { position: Position; name: string; keywords: string[]; coreMeaning: string; positionText: string; focusNote: string }[];
}

export type ProviderOutcome<T> =
  | { ok: true; value: T; model: string; usage?: { inputTokens: number; outputTokens: number } }
  | {
      ok: false;
      reason: string;
      /** The provider's own error type/message when it sent one — never contains the key or the question. */
      detail?: string;
      /** Worth a second paid attempt (overload, transient network, timeout). */
      retryable: boolean;
      /** The provider may have done the work (timeout after send) — counts as spent. */
      uncertain: boolean;
    };

export interface GenerationProvider {
  readonly name: string;
  classify(question: string): Promise<ProviderOutcome<SafetyCategory>>;
  interpret(input: InterpretationInput): Promise<ProviderOutcome<unknown>>;
}
