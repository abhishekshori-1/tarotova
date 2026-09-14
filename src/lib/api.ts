import type { Focus } from "@/content/types";
import type { InterpretationView } from "@/server/generation/types";

export type { InterpretationOutput, InterpretationView } from "@/server/generation/types";

export type Entitlement = "granted" | "eligible" | "verification_required";
export type SendStatus = "pending" | "accepted" | "failed";

export interface PendingChallenge {
  expiresAt: number;
  sendStatus: SendStatus;
  attemptsRemaining: number;
  resendAvailableAt: number;
}

export interface ReadingStatus {
  id: string;
  state: "drafting" | "locked";
  revision: number;
  focus: Focus;
  question: string | null;
  selectedSlots: number[];
  locked: boolean;
  /** Whether this browser can read the result now, will be able to once it locks, or must verify first. */
  entitlement: Entitlement;
  accessExpiresAt?: number;
  sessionVerified: boolean;
  resultAvailable: boolean;
}

export interface SessionVerification {
  verified: boolean;
  verifiedUntil?: number;
  guestReadingUsed: boolean;
  maskedEmail?: string;
  pendingChallenge?: PendingChallenge;
}

export interface ApiError extends Error {
  status: number;
  body: { error?: string; reason?: string; currentRevision?: number };
  retryAfterSeconds?: number;
}

async function asJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const err = new Error((body as { error?: string }).error ?? `http_${res.status}`) as ApiError;
    err.status = res.status;
    err.body = body as ApiError["body"];
    const retryAfter = res.headers.get("Retry-After");
    if (retryAfter !== null) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) err.retryAfterSeconds = Math.ceil(seconds);
    }
    throw err;
  }
  return body;
}

function json(method: string, body?: unknown) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) };
}

export function createReading(focus?: Focus, question?: string) {
  return fetch("/api/readings", json("POST", { focus, question: question || undefined })).then((r) => asJson<ReadingStatus>(r));
}

export function getStatus(id: string) {
  return fetch(`/api/readings/${id}/status`, { cache: "no-store" }).then((r) => asJson<ReadingStatus>(r));
}

export function updateContext(id: string, revision: number, question: string | null) {
  return fetch(`/api/readings/${id}/context`, json("PATCH", { revision, question })).then((r) => asJson<ReadingStatus>(r));
}

export function reshuffle(id: string, revision: number) {
  return fetch(`/api/readings/${id}/shuffle`, json("POST", { revision })).then((r) => asJson<ReadingStatus>(r));
}

export function updateSelection(id: string, revision: number, slots: number[], opts?: { lock?: boolean; focus?: Focus; turnstileToken?: string | null }) {
  return fetch(
    `/api/readings/${id}/selection`,
    json("PUT", { revision, slots, lock: opts?.lock ?? false, focus: opts?.focus, turnstileToken: opts?.turnstileToken ?? undefined }),
  ).then((r) => asJson<ReadingStatus>(r));
}

export function getSession() {
  return fetch("/api/session", { cache: "no-store" }).then((r) => asJson<SessionVerification>(r));
}

export function requestSessionCode(email: string, turnstileToken?: string | null) {
  return fetch("/api/session/verification", json("POST", { email, turnstileToken: turnstileToken ?? undefined })).then((r) =>
    asJson<{ sendStatus: "accepted" | "pending"; devCode?: string }>(r),
  );
}

export function confirmSessionCode(code: string) {
  return fetch("/api/session/verification/confirm", json("POST", { code })).then((r) => asJson<{ ok: boolean }>(r));
}

export interface ResultCard {
  position: "situation" | "challenge" | "guidance";
  id: string;
  name: string;
  numeral: string;
  keywords: string[];
  interpretation: string;
  focusNote: string;
}
export interface ReadingResult {
  question: string | null;
  focus: Focus;
  overview: string;
  reflection: string;
  cards: ResultCard[];
  /** The contextual answer's state; `disabled` means the feature is off server-side. */
  interpretation: InterpretationView;
}

export function getResult(id: string) {
  return fetch(`/api/readings/${id}/result`, { cache: "no-store" }).then((r) => asJson<ReadingResult>(r));
}

/** Idempotent: claims or reports the reading's contextual answer (202 while it is being written). */
export function requestInterpretation(id: string) {
  return fetch(`/api/readings/${id}/interpretation`, json("POST")).then((r) => asJson<InterpretationView>(r));
}
