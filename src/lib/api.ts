import type { Focus } from "@/content/types";

export interface ReadingStatus {
  id: string;
  state: "drafting" | "locked" | "verified";
  revision: number;
  focus: Focus;
  selectedSlots: number[];
  locked: boolean;
  maskedEmail?: string;
  pendingChallenge?: {
    expiresAt: number;
    sendStatus: "pending" | "accepted" | "failed";
    attemptsRemaining: number;
    resendAvailableAt: number;
  };
  resultAvailable: boolean;
}

async function asJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const err = new Error((body as { error?: string }).error ?? `http_${res.status}`) as Error & {
      status: number;
      body: unknown;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export function createReading() {
  return fetch("/api/readings", { method: "POST" }).then((r) => asJson<ReadingStatus>(r));
}

export function getStatus(id: string) {
  return fetch(`/api/readings/${id}/status`, { cache: "no-store" }).then((r) => asJson<ReadingStatus>(r));
}

export function reshuffle(id: string, revision: number) {
  return fetch(`/api/readings/${id}/shuffle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision }),
  }).then((r) => asJson<ReadingStatus>(r));
}

export function updateSelection(
  id: string,
  revision: number,
  slots: number[],
  opts?: { lock?: boolean; focus?: Focus },
) {
  return fetch(`/api/readings/${id}/selection`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision, slots, lock: opts?.lock ?? false, focus: opts?.focus }),
  }).then((r) => asJson<ReadingStatus>(r));
}

export function sendOtp(
  id: string,
  revision: number,
  email: string,
  intent: "send" | "resend" | "change",
  turnstileToken?: string | null,
) {
  return fetch(`/api/readings/${id}/otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision, email, intent, turnstileToken: turnstileToken ?? undefined }),
  }).then((r) => asJson<{ sendStatus: string; devCode?: string }>(r));
}

export function verifyCode(id: string, code: string) {
  return fetch(`/api/readings/${id}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  }).then((r) => asJson<{ ok: boolean }>(r));
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
  focus: Focus;
  overview: string;
  reflection: string;
  cards: ResultCard[];
}

export function getResult(id: string) {
  return fetch(`/api/readings/${id}/result`, { cache: "no-store" }).then((r) => asJson<ReadingResult>(r));
}
