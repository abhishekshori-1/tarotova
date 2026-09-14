"use client";

import type { InterpretationView } from "@/lib/api";

const RETRY_REASONS: Record<string, string> = {
  busy: "I can't get to your question right now, the table's full. The cards and their reading below stand on their own. Come back in a bit.",
  not_configured: "I can't read against your question right now. The cards and their reading below stand on their own.",
  guest_paused: "Reading against your question is paused for first readings at the moment. The cards and their reading below stand on their own.",
};

/**
 * The contextual answer's panel (docs/PLAN-EXTENDED.md section 4D/5). The
 * editorial reading never waits on this: it renders as a reserved slot
 * that fills in, degrades to an honest "unavailable" line, or is replaced
 * by an authored safety response.
 */
export function InterpretationPanel({ view, onRetry, retryUsed }: { view: InterpretationView; onRetry: () => void; retryUsed: boolean }) {
  if (view.status === "disabled" || view.status === "not_applicable") return null;

  if (view.status === "refused") {
    return (
      <section className="panel mt-6 p-5 sm:p-6" aria-labelledby="safety-heading">
        <p className="eyebrow">Before the cards</p>
        <h2 id="safety-heading" className="prose-measure mt-2 text-xl">
          {view.response.heading}
        </h2>
        {view.response.body.map((paragraph) => (
          <p key={paragraph} className="prose-measure mt-3 leading-relaxed">
            {paragraph}
          </p>
        ))}
        <ul className="mt-4 space-y-2">
          {view.response.resources.map((r) => (
            <li key={r.label} className="prose-measure text-sm">
              <span className="font-medium">{r.label}.</span> <span className="text-[var(--fg-soft)]">{r.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="panel mt-6 p-5 sm:p-6" aria-labelledby="interpretation-heading" aria-live="polite" aria-busy={view.status === "idle" || view.status === "pending"}>
      <p className="eyebrow" id="interpretation-heading">
        About what you asked
      </p>
      <div className="answer-slot mt-2">
        {(view.status === "idle" || view.status === "pending") && (
          <div role="status" className="space-y-3 pt-1">
            <p className="text-sm text-[var(--fg-soft)]">Reading your cards against what you asked…</p>
            <div className="skeleton-line w-full" />
            <div className="skeleton-line w-11/12" />
            <div className="skeleton-line w-4/5" />
          </div>
        )}
        {view.status === "succeeded" && (
          <>
            <p className="prose-measure text-lg leading-relaxed">{view.answer.perspective}</p>
            {view.answer.beyondSpread && <p className="prose-measure mt-3 text-sm italic text-[var(--fg-soft)]">{view.answer.beyondSpread}</p>}
          </>
        )}
        {view.status === "unavailable" && <p className="prose-measure text-[var(--fg-soft)]">{RETRY_REASONS[view.reason]}</p>}
        {view.status === "failed" && (
          <div>
            <p className="prose-measure text-[var(--fg-soft)]">Couldn&apos;t get a read on your question this time. The cards and their reading below stand on their own.</p>
            {view.retryable && !retryUsed && (
              <button type="button" onClick={onRetry} className="btn-secondary mt-3 px-4 text-sm">
                Ask once more
              </button>
            )}
          </div>
        )}
      </div>
      <details className="mt-4 text-sm text-[var(--fg-soft)]">
        <summary className="cursor-pointer">Where this comes from</summary>
        <p className="prose-measure mt-2">
          The card meanings are written by people. This part is written for your question by an AI model (Anthropic Claude), working only from
          those meanings and your words. It&apos;s a way of seeing, not a forecast. It stays with this reading for 30 days, then it&apos;s gone.
        </p>
      </details>
    </section>
  );
}
