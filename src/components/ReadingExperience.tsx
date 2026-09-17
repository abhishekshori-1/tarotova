"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ReadingProgress } from "@/components/ReadingProgress";
import { InterpretationPanel } from "@/components/Interpretation";
import { FollowupPanel } from "@/components/Followups";
import { CardFace, CardLightbox, useCardLightbox } from "@/components/CardArt";
import { ReadingProse } from "@/components/ReadingProse";
import { getResult, getStatus, requestInterpretation, type ApiError, type InterpretationView, type ReadingResult } from "@/lib/api";
import { verifyHref } from "@/lib/nextPath";
import { canShowCardReading, watchInterpretation } from "@/lib/interpretationProgress";
import { FOCUS_META } from "@/content/focuses";

const POSITION_LABEL: Record<ReadingResult["cards"][number]["position"], string> = {
  situation: "Situation",
  challenge: "Challenge",
  guidance: "Guidance",
};
const POSITION_ROLE: Record<ReadingResult["cards"][number]["position"], string> = {
  situation: "where you are",
  challenge: "what's in the way",
  guidance: "the way through",
};

/** Jumps to the composer without a second form: scroll, then focus the existing field. */
function askAboutReading() {
  const section = document.getElementById("conversation");
  const field = document.getElementById("followup") as HTMLTextAreaElement | null;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  // Focus after the scroll settles so the keyboard does not cover the reading mid-scroll.
  window.setTimeout(() => field?.focus({ preventScroll: true }), reduce ? 0 : 350);
}

/**
 * The reading as one editorial page (docs/PLAN-READING-EXPERIENCE.md
 * section 3): a large labelled spread that indexes the page, an opening,
 * three developed card sections, how the cards connect, one reflection,
 * then the conversation. Old answers without a synthesis render without
 * that section; nothing here calls a model.
 */
export function ReadingExperience({ id, journey, onChange }: { id: string; journey?: { suggestions: string[] }; onChange?: () => void }) {
  const router = useRouter();
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<InterpretationView | null>(null);
  const [retryUsed, setRetryUsed] = useState(false);
  const generationRef = useRef<AbortController | null>(null);
  const lightbox = useCardLightbox();
  // Whether the conversation composer is actually on the page (server availability), not just whether the section could exist.
  const [composerShown, setComposerShown] = useState(false);

  const generate = useCallback(async (initial: InterpretationView) => {
    if (generationRef.current) return;
    const controller = new AbortController();
    generationRef.current = controller;
    try {
      await watchInterpretation({
        initial,
        request: (signal) => requestInterpretation(id, signal),
        read: async (signal) => (await getResult(id, signal)).interpretation,
        onUpdate: setInterpretation,
        signal: controller.signal,
      });
    } finally {
      if (generationRef.current === controller) generationRef.current = null;
      if (!controller.signal.aborted) onChange?.();
    }
  }, [id, onChange]);

  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const status = await getStatus(id);
      if (signal.aborted) return;
      if (status.state === "drafting") return router.replace(`/reading/${id}/choose`);
      const r = await getResult(id, signal);
      if (signal.aborted) return;
      setResult(r);
      setInterpretation(r.interpretation);
      if (r.interpretation.status === "idle" || r.interpretation.status === "pending") generate(r.interpretation);
    } catch (e) {
      if (signal.aborted) return;
      // Owned but not yet granted: verification unlocks this same reading.
      if ((e as ApiError).status === 403) return router.replace(verifyHref(`/reading/${id}/result`));
      setError("This reading isn't here anymore. It may have expired.");
    }
  }, [generate, id, router]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount for these client-fetch pages
    load(controller.signal);
    return () => {
      controller.abort();
      generationRef.current?.abort();
      generationRef.current = null;
    };
  }, [load]);

  function retry() {
    setRetryUsed(true);
    generate(interpretation ?? { status: "idle" });
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-lg">{error}</p>
        <Link href="/" className="mt-4 inline-block underline">
          Start a new reading
        </Link>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mx-auto min-h-screen max-w-md px-6 py-16 text-center text-[var(--fg-soft)]" aria-live="polite">
        Turning them over…
      </div>
    );
  }

  const showReading = !result.followupSupport && canShowCardReading(interpretation);
  const QuestionHeading = journey ? "h2" : "h1";
  const answer = interpretation?.status === "succeeded" ? interpretation.answer : null;
  // Answers stored before the longer shape have no synthesis; the section is simply absent.
  const synthesis = answer?.synthesis ?? null;
  const generalReading = !result.question || interpretation?.status === "disabled" || interpretation?.status === "not_applicable";
  const conversationOpen = interpretation?.status === "succeeded" || interpretation?.status === "not_applicable";
  // Link labels differ from the section headings so each heading stays the one match for its words.
  const sections: { href: string; label: string }[] = [
    { href: "#opening", label: "Opening" },
    ...result.cards.map((c) => ({ href: `#${c.position}`, label: `${POSITION_LABEL[c.position]} · ${c.name}` })),
    ...(synthesis ? [{ href: "#connect", label: "Together" }] : []),
    { href: "#reflection", label: "Reflection" },
    ...(composerShown ? [{ href: "#conversation", label: "Conversation" }] : []),
  ];

  const spread = (
    <ol className="hero-spread" aria-label="Your three cards">
      {result.cards.map((c, i) => (
        <li key={c.position} className="reveal-card min-w-0" style={{ animationDelay: `${i * 140}ms` }}>
          <a href={`#${c.position}`} title={`Go to ${c.name}`}>
            <CardFace id={c.id} name={c.name} alt={`${c.name}, ${POSITION_LABEL[c.position]}`} sizes="(min-width: 1024px) 140px, 30vw" priority className="spread-frame" />
          </a>
          <p className="mt-2 text-center text-[0.72rem] font-medium uppercase tracking-[0.08em] text-[var(--accent)]">{POSITION_LABEL[c.position]}</p>
          <p className="text-center font-serif text-sm leading-tight">{c.name}</p>
        </li>
      ))}
    </ol>
  );

  return (
    <article className={journey ? "min-w-0" : "mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-6"}>
      {!journey && <ReadingProgress current={2} />}
      <header className="mt-6">
        <p className="eyebrow">{result.question ? "You asked" : `${FOCUS_META[result.focus].label} reading`}</p>
        <QuestionHeading className="prose-measure title mt-1">{result.question ?? "No question. Read cold."}</QuestionHeading>
      </header>

      {result.followupSupport && (
        <section className="panel mt-6 p-6">
          <h2 className="text-2xl">{result.followupSupport.heading}</h2>
          {result.followupSupport.body.map((p) => <p key={p} className="prose-measure mt-4">{p}</p>)}
          <ul className="mt-5 space-y-3">{result.followupSupport.resources.map((r) => <li key={r.label}>{r.href ? <a href={r.href} className="underline">{r.label}</a> : r.label} {r.detail}</li>)}</ul>
        </section>
      )}

      {!result.followupSupport && !showReading && interpretation && (
        <InterpretationPanel view={interpretation} onRetry={retry} retryUsed={retryUsed} />
      )}

      {showReading && (
        <div className="reading-layout mt-8">
          {/* Rail: the spread as a visual index, then the section links, then the way into the conversation. */}
          <aside className="reading-rail">
            {spread}
            <nav className="section-links mt-5" aria-label="Sections of this reading">
              {sections.map((s) => <a key={s.href} href={s.href}>{s.label}</a>)}
            </nav>
            {composerShown && (
              <button type="button" onClick={askAboutReading} className="btn-secondary mt-4 w-full px-4 text-sm lg:w-auto">
                Ask about this reading
              </button>
            )}
          </aside>

          <div className="min-w-0">
            <section id="opening" className="reading-section">
              {generalReading ? (
                <>
                  <p className="eyebrow">The short of it</p>
                  <div className="reading-body prose-measure mt-3">
                    <p className="reading-opening">{result.overview}</p>
                  </div>
                </>
              ) : (
                interpretation && <InterpretationPanel view={interpretation} onRetry={retry} retryUsed={retryUsed} editorial />
              )}
              {!generalReading && !answer && (
                <div className="mt-6">
                  <p className="eyebrow">From the card library</p>
                  <p className="mt-2 text-sm text-[var(--fg-soft)]">General meanings for this spread, from the card library.</p>
                  <div className="reading-body prose-measure mt-3"><p>{result.overview}</p></div>
                </div>
              )}
            </section>

            {result.cards.map((c) => {
              const exploration = c.exploration;
              const relevance = answer?.cards.find((a) => a.position === c.position)?.relevance;
              return (
                <section key={c.position} id={c.position} className="reading-section" aria-labelledby={`${c.position}-heading`}>
                  <div className="reading-card-layout">
                    <button type="button" onClick={(event) => {
                      // Safari pointer clicks do not focus buttons by default.
                      event.currentTarget.focus({ preventScroll: true });
                      lightbox.open({ id: c.id, name: c.name, numeral: c.numeral, position: POSITION_LABEL[c.position] });
                    }} className="reading-card-art" aria-label={`Enlarge ${c.name}`}>
                      <CardFace id={c.id} name={c.name} alt="" sizes="(min-width: 640px) 152px, 128px" className="card-figure" />
                    </button>
                    <div className="min-w-0">
                      <p className="eyebrow">{POSITION_LABEL[c.position]} · {POSITION_ROLE[c.position]}</p>
                      <h2 id={`${c.position}-heading`} className="mt-1 text-2xl sm:text-3xl">
                        {c.name} <span className="text-base font-normal text-[var(--fg-soft)]">({c.numeral})</span>
                      </h2>
                      <p className="mt-1 text-sm text-[var(--fg-soft)]">{c.keywords.join(" · ")}</p>
                      <div className="reading-body prose-measure mt-5">
                        {relevance ? (
                          <ReadingProse text={relevance} />
                        ) : (
                          <>
                            {exploration && <p>{exploration}</p>}
                            <p>{c.interpretation}</p>
                            <p className="italic text-[var(--fg-soft)]">{c.focusNote}</p>
                          </>
                        )}
                      </div>
                      {relevance && (
                        <details className="mt-5 text-[var(--fg-soft)]">
                          <summary className="cursor-pointer text-sm font-medium">About this card</summary>
                          <div className="reading-body prose-measure mt-3 text-base">
                            {exploration && <p>{exploration}</p>}
                            <p>{c.interpretation}</p>
                            <p className="italic">{c.focusNote}</p>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}

            {synthesis && (
              <section id="connect" className="reading-section" aria-labelledby="connect-heading">
                <p className="eyebrow">Together</p>
                <h2 id="connect-heading" className="mt-1 text-2xl sm:text-3xl">How the cards connect</h2>
                <div className="reading-body prose-measure mt-5"><ReadingProse text={synthesis} /></div>
              </section>
            )}

            <section id="reflection" className="reading-section" aria-labelledby="reflection-heading">
              <div className="reflection-panel p-6 sm:p-8">
                <p className="eyebrow" id="reflection-heading">One to take with you</p>
                <p className="prose-measure mt-3 font-serif text-xl leading-snug sm:text-2xl">{answer ? answer.reflection : result.reflection}</p>
                {answer?.beyondSpread && <p className="prose-measure limit-note mt-5 text-sm text-[var(--fg-soft)]">{answer.beyondSpread}</p>}
              </div>
            </section>

            {conversationOpen && (
              <FollowupPanel readingId={id} focus={result.focus} suggestions={journey?.suggestions} onAvailability={setComposerShown} onChange={() => { void getResult(id).then((r) => setResult(r)).catch(() => {}); onChange?.(); }} />
            )}
          </div>
        </div>
      )}

      {!journey && (
        <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/" className="btn-primary inline-flex items-center px-6 py-3 text-sm">
            {(result.followupSupport || interpretation?.status === "refused") ? "Back to home" : "Pull again"}
          </Link>
          {showReading && <p className="text-sm text-[var(--fg-soft)]">This reading stays here for 30 days.</p>}
        </div>
      )}
      <CardLightbox card={lightbox.card} onClose={lightbox.close} />
    </article>
  );
}
