"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ReadingProgress } from "@/components/ReadingProgress";
import { InterpretationPanel } from "@/components/Interpretation";
import { getResult, getStatus, requestInterpretation, type ApiError, type InterpretationView, type ReadingResult } from "@/lib/api";
import { verifyHref } from "@/lib/nextPath";
import { FOCUS_META } from "@/content/focuses";

const POSITION_LABEL: Record<ReadingResult["cards"][number]["position"], string> = {
  situation: "Situation",
  challenge: "Challenge",
  guidance: "Guidance",
};

const POLL_INTERVAL_MS = 2500;
const POLL_LIMIT_MS = 75_000;

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<InterpretationView | null>(null);
  const [retryUsed, setRetryUsed] = useState(false);
  const pollingRef = useRef(false);

  // The editorial reading is already on screen; the contextual answer is
  // requested once (idempotent server-side) and polled while it is written.
  // A lost tab never triggers a second paid call: the server holds the lease.
  const generate = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    setInterpretation({ status: "pending" });
    const startedAt = Date.now();
    try {
      let view = await requestInterpretation(id);
      while (view.status === "pending" && Date.now() - startedAt < POLL_LIMIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        view = (await getResult(id)).interpretation;
        if (view.status === "idle") view = await requestInterpretation(id);
      }
      setInterpretation(view.status === "pending" ? { status: "failed", reason: "timeout", retryable: true } : view);
    } catch {
      setInterpretation({ status: "failed", reason: "request_failed", retryable: true });
    } finally {
      pollingRef.current = false;
    }
  }, [id]);

  const load = useCallback(async () => {
    try {
      const status = await getStatus(id);
      if (status.state === "drafting") return router.replace(`/reading/${id}/choose`);
      const r = await getResult(id);
      setResult(r);
      setInterpretation(r.interpretation);
      if (r.interpretation.status === "idle" || r.interpretation.status === "pending") generate();
    } catch (e) {
      // Owned but not yet granted: verification unlocks this same reading.
      if ((e as ApiError).status === 403) return router.replace(verifyHref(`/reading/${id}/result`));
      setError("This reading isn't here anymore. It may have expired.");
    }
  }, [generate, id, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is the intended pattern for this build's plain client-fetch pages
    load();
  }, [load]);

  function retry() {
    setRetryUsed(true);
    generate();
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
      <div className="mx-auto max-w-md px-6 py-16 text-center text-[var(--fg-soft)]" aria-live="polite">
        Turning them over…
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-5xl px-6 pb-16 pt-8">
      <ReadingProgress current={2} />
      <p className="eyebrow mt-6">{result.question ? "You asked" : `${FOCUS_META[result.focus].label} reading`}</p>
      <h1 className="prose-measure title mt-1">{result.question ?? "No question. Read cold."}</h1>

      {interpretation && <InterpretationPanel view={interpretation} onRetry={retry} retryUsed={retryUsed} />}

      <section className="mt-8 grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
        <ol className="flex min-w-0 justify-center gap-3 lg:justify-start" aria-label="Your three cards">
          {result.cards.map((c, i) => (
            <li key={c.position} className="reveal-card min-w-0 flex-1 max-w-24 sm:max-w-28" style={{ animationDelay: `${i * 140}ms` }}>
              <div className="card-frame relative aspect-[5/8] w-full">
                <Image src={`/cards/${c.id}.svg`} alt={`${c.name}, ${POSITION_LABEL[c.position]}`} fill sizes="112px" priority className="rounded-[0.6rem]" />
              </div>
              <p className="mt-2 text-center text-[0.7rem] text-[var(--fg-soft)]">{POSITION_LABEL[c.position]}</p>
            </li>
          ))}
        </ol>
        <div className="panel min-w-0 p-5 sm:p-6">
          <p className="eyebrow">The short of it</p>
          <p className="prose-measure mt-2 text-lg leading-relaxed">{result.overview}</p>
        </div>
      </section>

      <div className="mt-12 space-y-10">
        {result.cards.map((c) => (
          <section key={c.position} className="grid gap-5 border-t border-[var(--line)] pt-8 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <div className="card-frame relative mx-auto aspect-[5/8] w-32 sm:mx-0 sm:w-36">
              <Image src={`/cards/${c.id}.svg`} alt="" fill sizes="144px" className="rounded-[0.6rem]" />
            </div>
            <div>
              <p className="eyebrow">{POSITION_LABEL[c.position]}</p>
              <h2 className="mt-1 text-2xl">
                {c.name} <span className="text-base font-normal text-[var(--fg-soft)]">({c.numeral})</span>
              </h2>
              <p className="mt-1 text-sm text-[var(--fg-soft)]">{c.keywords.join(" · ")}</p>
              <p className="prose-measure mt-4 leading-relaxed">{c.interpretation}</p>
              <p className="prose-measure mt-3 italic text-[var(--fg-soft)]">{c.focusNote}</p>
              {interpretation?.status === "succeeded" && (
                <div className="mt-4 border-l-2 border-[var(--accent)] pl-4">
                  <p className="eyebrow">On your question</p>
                  <p className="prose-measure mt-1 leading-relaxed">{interpretation.answer.cards.find((a) => a.position === c.position)?.relevance}</p>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {interpretation?.status === "succeeded" && (
        <section className="panel mt-12 p-5 sm:p-6">
          <p className="eyebrow">Try this</p>
          <p className="prose-measure mt-2 text-lg">{interpretation.answer.reflection}</p>
        </section>
      )}

      <section className={`panel p-5 sm:p-6 ${interpretation?.status === "succeeded" ? "mt-6" : "mt-12"}`}>
        <p className="eyebrow">One to take with you</p>
        <p className="prose-measure mt-2 text-lg">{result.reflection}</p>
      </section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link href="/" className="btn-primary inline-flex items-center px-6 py-3 text-sm">
          Pull again
        </Link>
        <p className="text-sm text-[var(--fg-soft)]">The next one asks for your email, once. This reading stays here for 30 days.</p>
      </div>
    </article>
  );
}
