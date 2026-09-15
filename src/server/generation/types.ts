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
  | { status: "pending"; classifiedCategory?: "none" | "stressful" }
  | { status: "unavailable"; reason: "not_configured" | "guest_paused" | "busy"; retryAfterSeconds?: number; classifiedCategory?: "none" | "stressful" }
  | { status: "succeeded"; answer: InterpretationOutput; model: string; promptVersion: string }
  | { status: "refused"; category: SafetyCategory; response: SafetyResponse }
  | { status: "failed"; reason: string; retryable: boolean; classifiedCategory?: "none" | "stressful" };

export interface ProviderCallOptions {
  /** Absolute request deadline, shared by triage, writing, review, repair and fallback. */
  deadlineAt: number;
}

export interface InterpretationInput {
  question: string;
  safetyCategory: "none" | "stressful";
  focusLabel: string;
  cards: { position: Position; name: string; keywords: string[]; coreMeaning: string; positionText: string; focusNote: string }[];
}

export type ProviderOutcome<T> =
  | { ok: true; value: T; model: string; usage?: TokenUsage }
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

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Prompt-cache accounting where the vendor reports it (Anthropic): billed at 1.25x/2x and 0.1x respectively. */
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
}

/**
 * Earlier turns the classifier needs to read the latest message correctly
 * ("should I stop taking it?" after a message about medication). User text
 * only, in order; never assistant text.
 */
export interface ConversationContext {
  originalQuestion: string | null;
  priorUserMessages: string[];
}

/** A follow-up turn's validated answer (docs/RELEASE-C.md section 3). */
export interface FollowupOutput {
  paragraphs: string[];
  reflection: string | null;
  beyondSpread: string | null;
}

/** What the follow-up writer and reviewer see: this reading only, speakers preserved, generated text marked as such. */
export interface FollowupInput {
  focusLabel: string;
  cards: InterpretationInput["cards"];
  originalQuestion: string | null;
  /** Generated earlier; may be wrong; never evidence about the person. */
  initialAnswer: InterpretationOutput | null;
  priorTurns: { user: string; assistant: FollowupOutput | null }[];
  latest: string;
  safetyCategory: "none" | "stressful";
  journeyPrompt?: string;
}

export interface GenerationProvider {
  readonly name: string;
  classify(question: string, options?: ProviderCallOptions, context?: ConversationContext): Promise<ProviderOutcome<SafetyCategory>>;
  interpret(input: InterpretationInput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>>;
  review(input: InterpretationInput, answer: InterpretationOutput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>>;
  repair(input: InterpretationInput, answer: InterpretationOutput, issues: GroundingIssue[], options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>>;
  followup(input: FollowupInput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>>;
  reviewFollowup(input: FollowupInput, answer: FollowupOutput, options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>>;
  repairFollowup(input: FollowupInput, answer: FollowupOutput, issues: GroundingIssue[], options?: ProviderCallOptions): Promise<ProviderOutcome<unknown>>;
}

export const ANSWER_FIELDS = ["perspective", "situation", "challenge", "guidance", "reflection", "beyondSpread"] as const;
export type AnswerField = (typeof ANSWER_FIELDS)[number];
export const FOLLOWUP_FIELDS = ["paragraph_1", "paragraph_2", "paragraph_3", "reflection", "beyondSpread"] as const;
export type FollowupField = (typeof FOLLOWUP_FIELDS)[number];
export interface GroundingIssue {
  field: AnswerField | FollowupField;
  quote: string;
  reason: string;
}
export interface GroundingReview {
  decision: "pass" | "revise";
  issues: GroundingIssue[];
}
