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
export function FollowupPanel({ readingId, focus, suggestions, onChange, onAvailability }: { readingId: string; focus: Focus; suggestions?: string[]; onChange?: () => void; onAvailability?: (composerShown: boolean) => void }) {
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

  // The parent's "Ask about this reading" control must point at a composer that exists: the server decides that.
  const composerShown = !!view && view.available;
  useEffect(() => { onAvailability?.(composerShown); }, [composerShown, onAvailability]);

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
      onChange?.();
      setText("");
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409) {
        // The server said no: show its view again (the optimistic slot goes), keep the typed text, and explain outside the form.
        await load();
        if (err.body?.error === "busy") setError("The table's full right now. Try again in a little while.");
        else if (err.body?.error === "retry_superseded") setError("That one can't be retried now that the conversation has moved on.");
      } else {
        // Network or server trouble: keep the text and offer the same submission again.
        setView((v) => v && { ...v, turns: v.turns.map((t) => (t.submissionId === submissionId ? { submissionId, sequence: t.sequence, text: body, status: "failed", reason: "request_failed", retryable: true } : t)) });
      }
    } finally {
      setBusy(false);
      inFlight.current = null;
    }
  }

  if (!view) return null;
  // Nothing to show until there is history or a way to start one. When the
  // feature is switched off, what was already shown stays readable.
  if (view.turns.length === 0 && !view.available && view.reason !== "turn_in_flight") return null;

  const remaining = view.remaining;
  const closedBySupport = view.turns.some((t) => t.status === "refused");

  return (
    <section id="conversation" className="conversation-section reading-section mt-12 border-t border-[var(--line)] pt-8" aria-labelledby="followups-heading">
      <p className="eyebrow">Continue</p>
      <h2 className="mt-1 text-2xl sm:text-3xl" id="followups-heading">
        {FOLLOWUP_COPY.heading}
      </h2>
      {view.turns.length === 0 && <p className="prose-measure mt-3 text-[var(--fg-soft)]">{FOLLOWUP_COPY.intro}</p>}

      <ol className="conversation-thread mt-6 space-y-8" aria-live="polite" aria-relevant="additions text">
        {view.turns.map((turn) => (
          <li key={turn.submissionId} className="conversation-turn">
            <div className="reader-message">
              <p className="eyebrow">Your words · {turn.sequence} of 3</p>
              <p className="prose-measure mt-2 font-serif text-xl leading-snug">{turn.text}</p>
            </div>
            <div className="mt-3">
              <Turn turn={turn} onRetry={() => submit(turn.submissionId, turn.text)} busy={busy} />
            </div>
          </li>
        ))}
      </ol>

      {view.available && (
        <form
          className="panel mt-8 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            const body = text.trim();
            if (body) submit(newSubmissionId(), body);
          }}
        >
          <p className="mb-3 text-sm text-[var(--fg-soft)]">A starting point, if you want one</p>
          <div className="flex flex-wrap gap-2">
            {(suggestions ?? FOLLOWUP_SUGGESTIONS[focus]).filter((s) => !view.turns.some((t) => t.text === s)).map((s) => (
              <button key={s} type="button" className="chip" onClick={() => { if (!text.trim() || window.confirm("Replace the follow-up you have written?")) setText(s); }} disabled={busy}>
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
          <p className="mt-3 text-xs text-[var(--fg-soft)]">Retries use the same follow-up.</p>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {!view.available && view.reason === "allowance_exhausted" && <div className="reflection-panel mt-8 p-6"><h3 className="text-xl">{FOLLOWUP_COPY.ended}</h3><p className="prose-measure mt-3 text-[var(--fg-soft)]">{FOLLOWUP_COPY.endingNote}</p></div>}
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
      <div className="answer-arrival reading-body rounded-2xl bg-[var(--raised)] p-5 sm:p-7">
        {turn.answer.paragraphs.map((p, i) => (
          <p key={`${i}-${p.slice(0, 24)}`} className="prose-measure">
            {p}
          </p>
        ))}
        {turn.answer.reflection && <p className="prose-measure reflection-panel mt-5 p-4 text-lg leading-relaxed">{turn.answer.reflection}</p>}
        {turn.answer.beyondSpread && <p className="prose-measure limit-note mt-5 text-sm text-[var(--fg-soft)]">{turn.answer.beyondSpread}</p>}
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
