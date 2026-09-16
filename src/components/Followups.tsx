"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FOLLOWUP_COPY, FOLLOWUP_SUGGESTIONS } from "@/content/followups";
import type { Focus } from "@/content/types";
import { listFollowups, newSubmissionId, sendFollowup, type ApiError, type FollowupTurnView, type FollowupsView } from "@/lib/api";
import { FOLLOWUP_MAX_LENGTH } from "@/lib/schemas";

const POLL_INTERVAL_MS = 2500;
const POLL_LIMIT_MS = 75_000;

/** Polls the list while the sent turn is still pending; bounded, outside the component so the React compiler sees no impure render. */
async function settleTurn(readingId: string, submissionId: string, first: FollowupsView): Promise<FollowupsView> {
  let next = first;
  const startedAt = Date.now();
  while (next.turns.some((t) => t.submissionId === submissionId && t.status === "pending") && Date.now() - startedAt < POLL_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    next = await listFollowups(readingId);
  }
  return next;
}

/**
 * The conversation under a reading (docs/RELEASE-C.md section 2): a
 * reading with a conversation underneath, not a chat screen. One turn in
 * flight; the sent text shows at once; a failed turn keeps its text and
 * retries with the same submission id; a support response ends it.
 */
export function FollowupPanel({ readingId, focus }: { readingId: string; focus: Focus }) {
  const [view, setView] = useState<FollowupsView | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<{ submissionId: string; text: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const v = await listFollowups(readingId, signal);
      if (!signal?.aborted) setView(v);
    } catch {
      // A missing list leaves the section out; the reading stands.
    }
  }, [readingId]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount for these client-fetch pages
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function submit(submissionId: string, body: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    inFlight.current = { submissionId, text: body };
    // Show the sent text immediately, in a stable pending slot.
    setView((v) => v && { ...v, available: false, reason: "turn_in_flight", turns: [...v.turns.filter((t) => t.submissionId !== submissionId), { submissionId, sequence: v.turns.length + 1, text: body, status: "pending" }] });
    try {
      const next = await settleTurn(readingId, submissionId, await sendFollowup(readingId, submissionId, body));
      setView(next);
      setText("");
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409 && err.body?.error === "turn_in_flight") await load();
      else if (err.status === 409 && err.body?.error === "busy") setError("The table's full right now. Try again in a little while.");
      else if (err.status === 409) await load();
      else {
        // Network or server trouble: keep the text and offer the same submission again.
        setView((v) => v && { ...v, turns: v.turns.map((t) => (t.submissionId === submissionId ? { submissionId, sequence: t.sequence, text: body, status: "failed", reason: "request_failed", retryable: true } : t)) });
      }
    } finally {
      setBusy(false);
      inFlight.current = null;
    }
  }

  if (!view || view.status === "disabled") return null;
  if (view.turns.length === 0 && !view.available && view.reason !== "turn_in_flight") return null;

  const remaining = view.remaining;
  const closedBySupport = view.turns.some((t) => t.status === "refused");

  return (
    <section className="mt-12 border-t border-[var(--line)] pt-8" aria-labelledby="followups-heading">
      <p className="eyebrow" id="followups-heading">
        {FOLLOWUP_COPY.heading}
      </p>
      {view.turns.length === 0 && <p className="prose-measure mt-2 text-sm text-[var(--fg-soft)]">{FOLLOWUP_COPY.intro}</p>}

      <ol className="mt-4 space-y-6" aria-live="polite">
        {view.turns.map((turn) => (
          <li key={turn.submissionId}>
            <p className="prose-measure text-sm text-[var(--fg-soft)]">You asked</p>
            <p className="prose-measure mt-1 font-medium">{turn.text}</p>
            <div className="mt-3">
              <Turn turn={turn} onRetry={() => submit(turn.submissionId, turn.text)} busy={busy} />
            </div>
          </li>
        ))}
      </ol>

      {view.available && (
        <form
          className="mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            const body = text.trim();
            if (body) submit(newSubmissionId(), body);
          }}
        >
          <div className="flex flex-wrap gap-2">
            {FOLLOWUP_SUGGESTIONS[focus].map((s) => (
              <button key={s} type="button" className="chip" onClick={() => setText(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
          <label htmlFor="followup" className="mt-4 block text-sm font-medium">
            Your follow-up
          </label>
          <textarea id="followup" value={text} maxLength={FOLLOWUP_MAX_LENGTH} rows={2} onChange={(e) => setText(e.target.value)} placeholder={FOLLOWUP_COPY.placeholder} className="field mt-2 resize-y" disabled={busy} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[var(--fg-soft)]">
              {FOLLOWUP_COPY.remaining(remaining)}
              <span aria-hidden="true"> · </span>
              {text.length}/{FOLLOWUP_MAX_LENGTH}
            </span>
            <button type="submit" disabled={busy || !text.trim()} className="btn-primary px-5 text-sm">
              {busy ? FOLLOWUP_COPY.pending : FOLLOWUP_COPY.send}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      )}

      {!view.available && view.reason === "allowance_exhausted" && <p className="prose-measure mt-6 text-sm text-[var(--fg-soft)]">{FOLLOWUP_COPY.ended}</p>}
      {closedBySupport && <p className="prose-measure mt-6 text-sm text-[var(--fg-soft)]">{FOLLOWUP_COPY.closed}</p>}
    </section>
  );
}

function Turn({ turn, onRetry, busy }: { turn: FollowupTurnView; onRetry: () => void; busy: boolean }) {
  if (turn.status === "pending") {
    return (
      <div role="status" className="space-y-3 pt-1">
        <p className="text-sm text-[var(--fg-soft)]">{FOLLOWUP_COPY.pending}</p>
        <div className="skeleton-line w-full" />
        <div className="skeleton-line w-4/5" />
      </div>
    );
  }
  if (turn.status === "succeeded") {
    return (
      <div className="panel p-5">
        {turn.answer.paragraphs.map((p) => (
          <p key={p} className="prose-measure leading-relaxed [&+&]:mt-3">
            {p}
          </p>
        ))}
        {turn.answer.reflection && <p className="prose-measure mt-3 italic text-[var(--fg-soft)]">{turn.answer.reflection}</p>}
        {turn.answer.beyondSpread && <p className="prose-measure mt-3 text-sm text-[var(--fg-soft)]">{turn.answer.beyondSpread}</p>}
      </div>
    );
  }
  if (turn.status === "refused") {
    return (
      <div className="panel p-5">
        <h3 className="prose-measure text-lg">{turn.response.heading}</h3>
        {turn.response.body.map((paragraph) => (
          <p key={paragraph} className="prose-measure mt-3 leading-relaxed">
            {paragraph}
          </p>
        ))}
        <ul className="mt-4 space-y-2">
          {turn.response.resources.map((r) => (
            <li key={r.label} className="prose-measure text-sm">
              {r.href ? (
                <a href={r.href} className="font-medium underline" rel="noreferrer">
                  {r.label}
                </a>
              ) : (
                <span className="font-medium">{r.label}.</span>
              )}{" "}
              <span className="text-[var(--fg-soft)]">{r.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div>
      <p className="prose-measure text-sm text-[var(--fg-soft)]">{FOLLOWUP_COPY.failed}</p>
      {turn.retryable && (
        <button type="button" onClick={onRetry} disabled={busy} className="btn-secondary mt-2 px-4 text-sm">
          {FOLLOWUP_COPY.retry}
        </button>
      )}
    </div>
  );
}
