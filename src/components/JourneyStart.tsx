"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createJourney, newSubmissionId } from "@/lib/api";
import type { JourneyTemplate } from "@/content/journeys";
import { useHydrated } from "@/lib/useHydrated";
import { verifyHref } from "@/lib/nextPath";
export function JourneyStart({ template }: { template: JourneyTemplate }) {
  const router = useRouter();
  const ready = useHydrated();
  const [question, setQuestion] = useState(template.starter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef<{ question: string; id: string } | null>(null);
  return <form className="panel mt-10 p-5 sm:p-7" onSubmit={async (e) => {
    e.preventDefault(); if (busy) return;
    const text = question.trim(); if (!text) return;
    if (!pending.current || pending.current.question !== text) pending.current = { question: text, id: newSubmissionId() };
    setBusy(true); setError(false);
    try {
      const run = await createJourney(template.slug, text, pending.current.id);
      const next = `/journey/${run.id}`;
      router.push(run.reading.entitlement === "verification_required" ? verifyHref(next) : next);
    } catch { setError(true); setBusy(false); }
  }}>
    <label htmlFor="journey-question" className="block font-medium">Make the question yours</label><p className="mt-2 text-sm text-[var(--fg-soft)]">{template.clarification}</p>
    <textarea id="journey-question" className="field mt-4" rows={3} maxLength={500} value={question} disabled={!ready || busy} onChange={(e) => setQuestion(e.target.value)}/>
    <p className="mt-2 text-xs text-[var(--fg-soft)]">Your question is saved with this reading. {question.length}/500</p>
    <button disabled={!ready || busy || !question.trim()} className="btn-primary mt-5 px-6 py-3">{busy ? "Opening your journey…" : "Begin this journey"}</button>
    {error && <p role="alert" className="mt-3 text-sm">Your journey could not be opened. Your question is still here; try again.</p>}
    <p className="mt-4 text-sm text-[var(--fg-soft)]">Your first reading needs no email. After that, verification keeps you going.</p>
  </form>;
}
