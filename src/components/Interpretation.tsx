"use client";

import { classifiedCategory } from "@/lib/interpretationProgress";
import type { InterpretationView } from "@/lib/api";

const RETRY_REASONS: Record<string, string> = {
  busy: "Your question couldn't be read right now. Please come back in a little while.",
  not_configured: "Reading against your question is unavailable at the moment.",
  guest_paused: "Reading against your question is paused for first readings at the moment.",
};

/**
 * The answer or support note appears before any card advice. In `editorial`
 * mode (the reading page) the opening perspective is set as the page's own
 * prose rather than inside a panel; the waiting and failure states keep their
 * reserved space so arriving text never shifts what is above it.
 */
export function InterpretationPanel({ view, onRetry, retryUsed, editorial = false }: { view: InterpretationView; onRetry: () => void; retryUsed: boolean; editorial?: boolean }) {
  const triaged = classifiedCategory(view) !== undefined;
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
              {r.href ? <a href={r.href} className="font-medium underline" rel="noreferrer">{r.label}</a> : <span className="font-medium">{r.label}.</span>} <span className="text-[var(--fg-soft)]">{r.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const body = (
    <div className="answer-slot mt-3">
      {(view.status === "idle" || view.status === "pending") && (
        <div role="status" className="space-y-3 pt-1">
          <p className="text-sm text-[var(--fg-soft)]">{triaged ? "Your cards are below. Writing the answer to your question…" : "Taking a moment with your question…"}</p>
          <div className="skeleton-line w-full" />
          <div className="skeleton-line w-11/12" />
          <div className="skeleton-line w-4/5" />
        </div>
      )}
      {view.status === "succeeded" && (
        <div className={editorial ? "reading-body prose-measure answer-arrival" : "prose-measure"}>
          <p className={editorial ? "reading-opening" : "text-lg leading-relaxed"}>{view.answer.perspective}</p>
          {!editorial && view.answer.beyondSpread && <p className="limit-note mt-5 text-sm text-[var(--fg-soft)]">{view.answer.beyondSpread}</p>}
        </div>
      )}
      {view.status === "unavailable" && <p className="prose-measure text-[var(--fg-soft)]">{RETRY_REASONS[view.reason]}</p>}
      {view.status === "failed" && (
        <div>
          <p className="prose-measure text-[var(--fg-soft)]">{triaged ? "The answer to your question couldn’t be completed. Your cards and their general meanings are still here." : "Couldn’t read your question this time. Your question and drawn cards are saved."}</p>
          {view.retryable && !retryUsed && (
            <button type="button" onClick={onRetry} className="btn-secondary mt-3 px-4 text-sm">
              Ask once more
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (editorial) {
    return (
      <div aria-labelledby="interpretation-heading" aria-live="polite" aria-busy={view.status === "idle" || view.status === "pending"}>
        <p className="eyebrow" id="interpretation-heading">On your question</p>
        {body}
      </div>
    );
  }
  return (
    <section className="panel mt-6 p-5 sm:p-6" aria-labelledby="interpretation-heading" aria-live="polite" aria-busy={view.status === "idle" || view.status === "pending"}>
      <p className="eyebrow" id="interpretation-heading">On your question</p>
      {body}
    </section>
  );
}
