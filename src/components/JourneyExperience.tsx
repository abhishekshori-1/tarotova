"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { advanceJourney, getJourney, newSubmissionId, type ApiError, type JourneyView } from "@/lib/api";
import { journeyErrorMessage } from "@/lib/journeyErrors";
import { verifyHref } from "@/lib/nextPath";
import type { JourneyStage } from "@/content/journeys";
import { ReadingExperience } from "./ReadingExperience";
import { JourneyMotif } from "./JourneyMotif";

export function JourneyExperience({ id }: { id: string }) {
  const router = useRouter();
  const [view, setView] = useState<JourneyView | null>(null);
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
  async function move(destination: JourneyStage) {
    if (!view || busy) return;
    if (!pending.current || pending.current.destination !== destination || pending.current.revision !== view.revision) pending.current = { destination, revision: view.revision, id: newSubmissionId() };
    setBusy(true); setError(null);
    try { setView(await advanceJourney(id, pending.current.revision, pending.current.id, destination)); pending.current = null; }
    catch (e) {
      if ((e as ApiError).status === 403) router.push(verifyHref(`/journey/${id}`));
      else { await refresh(); if ((e as ApiError).status === 404) setMissing(true); else setError(journeyErrorMessage(e as ApiError)); }
    } finally { setBusy(false); }
  }
  if (missing) return <div className="mx-auto max-w-xl px-6 py-16"><h1 className="title">This journey is no longer available here.</h1><p className="mt-4">It may have expired, or belong to another browser. No new cards have been drawn.</p><Link href="/" prefetch={false} className="btn-secondary mt-6 inline-flex items-center px-5">Back to home</Link></div>;
  if (!view) return <div className="mx-auto max-w-xl px-6 py-16"><p role="status">{error ?? "Returning to your journey…"}</p>{error && <button onClick={refresh} className="btn-secondary mt-4 px-5">Try again</button>}</div>;
  const stage = view.stage;
  return <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
    <header><Link href="/" prefetch={false} className="inline-flex min-h-11 items-center text-sm underline">Home</Link><div className="flex items-center gap-4"><JourneyMotif motif={view.template.motif}/><div><p className="eyebrow">Your guided journey</p><h1 className="mt-2 text-3xl">{view.template.title}</h1></div></div>
      <ol className="journey-stages mt-6" aria-label="Journey progress">{(["frame", "explore", "reflect"] as const).map((s, i) => <li key={s} aria-current={(stage === s || (stage === "complete" && s === "reflect")) ? "step" : undefined}>{i + 1} · {s[0].toUpperCase() + s.slice(1)}</li>)}</ol>
    </header>
    {view.support ? <section className="panel mt-8 p-6"><h2 className="text-2xl">{view.support.heading}</h2>{view.support.body.map((p) => <p key={p} className="prose-measure mt-4">{p}</p>)}<ul className="mt-5 space-y-3">{view.support.resources.map((r) => <li key={r.label}>{r.href ? <a className="underline" href={r.href}>{r.label}</a> : r.label} {r.detail}</li>)}</ul><Link href="/" prefetch={false} className="btn-secondary mt-6 inline-flex items-center px-5">Back to home</Link></section> : <>
      {stage === "frame" && <section className="mt-8"><p className="eyebrow">Frame · Your starting point</p><h2 className="prose-measure mt-3 text-2xl">{view.reading.question}</h2><p className="prose-measure mt-5 text-[var(--fg-soft)]">{view.reading.locked ? "Your question and cards are saved. Return to the same reading when you are ready." : "Your question is a starting point, not a promise to solve everything. You can edit it while choosing your three cards."}</p>
        {view.reading.locked ? <button className="btn-primary mt-6 px-6 py-3" disabled={busy} onClick={() => move("explore")}>Explore your reading</button> : <Link href={view.reading.entitlement === "verification_required" ? verifyHref(`/reading/${view.readingId}/choose`) : `/reading/${view.readingId}/choose`} className="btn-primary mt-6 inline-flex items-center px-6 py-3">Choose your three cards</Link>}
      </section>}
      {stage === "explore" && <section className="mt-8"><p className="prose-measure text-[var(--fg-soft)]">{view.template.explore}</p><ReadingExperience id={view.readingId} journey={view.template} onChange={refresh}/><div className="reflection-panel mt-8 p-6"><h2 className="text-2xl">What would you like to take with you?</h2><p className="prose-measure mt-3">You can move to the closing reflection without using any follow-ups.</p><button className="btn-primary mt-5 px-5 py-3" disabled={busy || !view.canReflect} onClick={() => move("reflect")}>Continue to reflection</button></div><button className="btn-secondary mt-4 px-5" disabled={busy} onClick={() => move("frame")}>Back to your question</button></section>}
      {stage === "reflect" && <section className="reflection-panel mt-8 p-6 sm:p-10"><p className="eyebrow">Reflect · For yourself</p><h2 className="prose-measure mt-4 text-3xl leading-snug">{view.template.reflection}</h2><p className="prose-measure mt-6">There is nothing to submit here. Keep your answer to yourself, or leave the question open.</p><div className="mt-8 flex flex-wrap gap-3"><button className="btn-primary px-5 py-3" disabled={busy} onClick={() => move("complete")}>Finish this journey</button><button className="btn-secondary px-5" disabled={busy} onClick={() => move("explore")}>Return to the reading</button></div></section>}
      {stage === "complete" && <section className="reflection-panel mt-8 p-6 sm:p-10"><p className="eyebrow">Journey complete</p><h2 className="mt-3 text-3xl">A place to leave it, for now.</h2><p className="prose-measure mt-5 text-lg">{view.template.completion}</p><Link href={`/reading/${view.readingId}/result`} className="btn-secondary mt-6 inline-flex items-center px-5">Revisit your reading</Link></section>}
    </>}
    {error && <p role="alert" className="mt-5 text-sm">{error}</p>}
    <p className="mt-8 text-sm text-[var(--fg-soft)]">Saved in this browser until {new Date(view.expiresAt).toLocaleDateString()}. Your private reflections are not collected.</p>
  </div>;
}
