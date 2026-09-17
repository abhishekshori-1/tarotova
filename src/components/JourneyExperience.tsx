"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { advanceJourney, getJourney, getResult, newSubmissionId, type ApiError, type JourneyView, type ReadingResult } from "@/lib/api";
import { journeyErrorMessage } from "@/lib/journeyErrors";
import { verifyHref } from "@/lib/nextPath";
import type { JourneyStage } from "@/content/journeys";
import { ReadingExperience } from "./ReadingExperience";
import { JourneyMotif } from "./JourneyMotif";
import { CardFace } from "./CardArt";

const STAGES = [
  ["frame", "Frame"],
  ["explore", "Explore"],
  ["reflect", "Reflect"],
] as const;
const POSITION_LABEL = { situation: "Situation", challenge: "Challenge", guidance: "Guidance" } as const;

/**
 * A journey is the same reading and conversation inside four distinct
 * compositions (docs/PLAN-READING-EXPERIENCE.md section 3): Frame holds the
 * question, Explore holds the reading, Reflect holds one question with
 * nothing to submit, Complete shows what was already saved as a keepsake.
 * No stage calls a model.
 */
export function JourneyExperience({ id }: { id: string }) {
  const router = useRouter();
  const [view, setView] = useState<JourneyView | null>(null);
  const [keepsake, setKeepsake] = useState<ReadingResult | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ revision: number; destination: JourneyStage; id: string } | null>(null);
  const refresh = useCallback(async () => { try { setView(await getJourney(id)); } catch { setError("Could not refresh your journey. Please try again."); } }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    void getJourney(id, controller.signal).then(setView).catch((e: ApiError) => { if (!controller.signal.aborted) { if (e.status === 404) setMissing(true); else setError("Could not load your journey. Please try again."); } });
    return () => controller.abort();
  }, [id]);
  // The keepsake shows the saved reading only; it is read, never regenerated.
  useEffect(() => {
    if (view?.stage !== "complete" || keepsake) return;
    const controller = new AbortController();
    void getResult(view.readingId, controller.signal).then(setKeepsake).catch(() => {});
    return () => controller.abort();
  }, [view, keepsake]);

  async function move(destination: JourneyStage) {
    if (!view || busy) return;
    if (!pending.current || pending.current.destination !== destination || pending.current.revision !== view.revision) pending.current = { destination, revision: view.revision, id: newSubmissionId() };
    setBusy(true); setError(null);
    try { setView(await advanceJourney(id, pending.current.revision, pending.current.id, destination)); pending.current = null; window.scrollTo({ top: 0, behavior: "auto" }); }
    catch (e) {
      if ((e as ApiError).status === 403) router.push(verifyHref(`/journey/${id}`));
      else { await refresh(); if ((e as ApiError).status === 404) setMissing(true); else setError(journeyErrorMessage(e as ApiError)); }
    } finally { setBusy(false); }
  }

  if (missing) return <div className="mx-auto max-w-xl px-6 py-16"><h1 className="title">This journey is no longer available here.</h1><p className="mt-4">It may have expired, or belong to another browser. No new cards have been drawn.</p><Link href="/" prefetch={false} className="btn-secondary mt-6 inline-flex items-center px-5">Back to home</Link></div>;
  if (!view) return <div className="mx-auto max-w-xl px-6 py-16"><p role="status">{error ?? "Returning to your journey…"}</p>{error && <button onClick={refresh} className="btn-secondary mt-4 px-5">Try again</button>}</div>;
  const stage = view.stage;
  const supportPanel = view.support && (
    <section className="panel mt-8 p-6"><h2 className="text-2xl">{view.support.heading}</h2>{view.support.body.map((p) => <p key={p} className="prose-measure mt-4">{p}</p>)}<ul className="mt-5 space-y-3">{view.support.resources.map((r) => <li key={r.label}>{r.href ? <a className="underline" href={r.href}>{r.label}</a> : r.label} {r.detail}</li>)}</ul><Link href="/" prefetch={false} className="btn-secondary mt-6 inline-flex items-center px-5">Back to home</Link></section>
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:px-6 sm:py-10">
      <header>
        <Link href="/" prefetch={false} className="inline-flex min-h-11 items-center text-sm underline">Home</Link>
        <div className="mt-2 flex items-center gap-4">
          <JourneyMotif motif={view.template.motif} />
          <div>
            <p className="eyebrow">Your guided journey</p>
            <h1 className="mt-1 text-3xl sm:text-4xl">{view.template.title}</h1>
          </div>
        </div>
        <ol className="journey-stages mt-6 max-w-2xl" aria-label="Journey progress">
          {STAGES.map(([key, label], i) => (
            <li key={key} aria-current={(stage === key || (stage === "complete" && key === "reflect")) ? "step" : undefined}>{i + 1} · {label}</li>
          ))}
        </ol>
      </header>

      {view.support ? supportPanel : (
        <>
          {stage === "frame" && (
            <section className="journey-frame mt-8 max-w-3xl">
              <p className="eyebrow">Frame · Your starting point</p>
              <h2 className="prose-measure mt-3 font-serif text-2xl leading-snug sm:text-3xl">{view.reading.question}</h2>
              <p className="prose-measure mt-5 text-[var(--fg-soft)]">{view.reading.locked ? "Your question and cards are saved. Return to the same reading when you are ready." : "Your question is a starting point, not a promise to solve everything. You can edit it while choosing your three cards."}</p>
              {view.reading.locked
                ? <button className="btn-primary mt-6 px-6 py-3" disabled={busy} onClick={() => move("explore")}>Explore your reading</button>
                : <Link href={view.reading.entitlement === "verification_required" ? verifyHref(`/reading/${view.readingId}/choose`) : `/reading/${view.readingId}/choose`} className="btn-primary mt-6 inline-flex items-center px-6 py-3">Choose your three cards</Link>}
            </section>
          )}

          {stage === "explore" && (
            <section className="mt-8">
              <p className="prose-measure text-[var(--fg-soft)]">{view.template.explore}</p>
              <ReadingExperience id={view.readingId} journey={view.template} onChange={refresh} />
              <div className="journey-reflect mt-10 max-w-3xl">
                <h2 className="text-2xl">What would you like to take with you?</h2>
                <p className="prose-measure mt-3">You can move to the closing reflection without using any follow-ups.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="btn-primary px-5 py-3" disabled={busy || !view.canReflect} onClick={() => move("reflect")}>Continue to reflection</button>
                  <button className="btn-secondary px-5" disabled={busy} onClick={() => move("frame")}>Back to your question</button>
                </div>
              </div>
            </section>
          )}

          {stage === "reflect" && (
            <section className="journey-reflect mt-8 max-w-3xl">
              <p className="eyebrow">Reflect · For yourself</p>
              <h2 className="prose-measure mt-4 font-serif text-3xl leading-snug sm:text-4xl">{view.template.reflection}</h2>
              <p className="prose-measure mt-6 text-lg">There is nothing to submit here. Keep your answer to yourself, or leave the question open.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button className="btn-primary px-5 py-3" disabled={busy} onClick={() => move("complete")}>Finish this journey</button>
                <button className="btn-secondary px-5" disabled={busy} onClick={() => move("explore")}>Return to the reading</button>
              </div>
            </section>
          )}

          {stage === "complete" && (
            <section className="journey-keepsake mt-8 max-w-3xl" aria-labelledby="complete-heading">
              <p className="eyebrow">Journey complete</p>
              <h2 id="complete-heading" className="mt-3 text-3xl">A place to leave it, for now.</h2>
              {keepsake && (
                <div className="mt-6">
                  <p className="text-sm text-[var(--fg-soft)]">You asked</p>
                  <p className="prose-measure mt-1 font-serif text-xl leading-snug">{keepsake.question ?? "No question. Read cold."}</p>
                  <ol className="hero-spread mt-6" aria-label="Your three cards">
                    {keepsake.cards.map((c) => (
                      <li key={c.position} className="min-w-0">
                        <CardFace id={c.id} name={c.name} alt="" sizes="(min-width: 640px) 110px, 26vw" className="spread-frame" />
                        <p className="mt-2 text-center text-[0.7rem] uppercase tracking-[0.08em] text-[var(--accent)]">{POSITION_LABEL[c.position]}</p>
                        <p className="text-center font-serif text-sm leading-tight">{c.name}</p>
                      </li>
                    ))}
                  </ol>
                  <p className="prose-measure mx-auto mt-6 text-center font-serif text-lg leading-snug">{view.template.reflection}</p>
                </div>
              )}
              <p className="prose-measure mt-6 text-lg">{view.template.completion}</p>
              <Link href={`/reading/${view.readingId}/result`} className="btn-secondary mt-6 inline-flex items-center px-5">Revisit your reading</Link>
            </section>
          )}
        </>
      )}
      {error && <p role="alert" className="mt-5 text-sm">{error}</p>}
      <p className="mt-8 text-sm text-[var(--fg-soft)]">Saved in this browser until {new Date(view.expiresAt).toLocaleDateString()}. Your private reflections are not collected.</p>
    </div>
  );
}
