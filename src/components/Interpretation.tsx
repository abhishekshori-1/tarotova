"use client";

import type { InterpretationView } from "@/lib/api";

const RETRY_REASONS: Record<string, string> = {
  busy: "The personalized reflection is busy right now. Your cards and their reading above are complete; try again in a little while.",
  not_configured: "The personalized reflection isn't available right now. Your cards and their reading above are complete.",
  guest_paused: "Personalized reflections are paused for email-free readings at the moment. Your cards and their reading above are complete.",
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
        For your question
      </p>
      <div className="answer-slot mt-2">
        {(view.status === "idle" || view.status === "pending") && (
          <div role="status" className="space-y-3 pt-1">
            <p className="text-sm text-[var(--fg-soft)]">Writing a reflection for your question…</p>
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
            <p className="prose-measure text-[var(--fg-soft)]">We couldn&apos;t write the personalized reflection this time. Your cards and their reading above are complete.</p>
            {view.retryable && !retryUsed && (
              <button type="button" onClick={onRetry} className="btn-secondary mt-3 px-4 text-sm">
                Try once more
              </button>
            )}
          </div>
        )}
      </div>
      <details className="mt-4 text-sm text-[var(--fg-soft)]">
        <summary className="cursor-pointer">How this reflection is made</summary>
        <p className="prose-measure mt-2">
          The card meanings are written by people. This paragraph is written for your question by an AI model (Anthropic Claude) from those
          meanings and your words only. It offers perspective, not prediction, and stays with this reading for up to 30 days.
        </p>
      </details>
    </section>
  );
}
