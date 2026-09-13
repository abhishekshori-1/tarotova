"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getResult, getStatus, type ApiError, type ReadingResult } from "@/lib/api";
import { verifyHref } from "@/lib/nextPath";
import { FOCUS_META } from "@/content/focuses";

const POSITION_LABEL: Record<ReadingResult["cards"][number]["position"], string> = {
  situation: "Situation",
  challenge: "Challenge",
  guidance: "Guidance",
};

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const status = await getStatus(id);
      if (status.state === "drafting") return router.replace(`/reading/${id}/choose`);
      setResult(await getResult(id));
    } catch (e) {
      // Owned but not yet granted: verification unlocks this same reading.
      if ((e as ApiError).status === 403) return router.replace(verifyHref(`/reading/${id}/result`));
      setError("This result isn't available. It may have expired.");
    }
  }, [id, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is the intended pattern for this build's plain client-fetch pages
    load();
  }, [load]);

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
      <div className="mx-auto max-w-md px-6 py-16 text-center text-[var(--color-plum-soft)]" aria-live="polite">
        Revealing your cards…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm text-[var(--color-bronze)]">{result.question ? "Your question" : `${FOCUS_META[result.focus].label} reading`}</p>
      <h1 className="prose-measure mt-1 text-2xl font-semibold">{result.question ?? "A general reading"}</h1>
      <p className="prose-measure mt-4 text-[var(--color-plum-soft)]">{result.overview}</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {result.cards.map((c) => (
          <div key={c.position} className="rounded-lg border border-[var(--color-border)] bg-white/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-bronze)]">{POSITION_LABEL[c.position]}</p>
            <div className="relative mx-auto mt-3 aspect-[5/8] w-32">
              <Image src={`/cards/${c.id}.svg`} alt={c.name} fill sizes="128px" />
            </div>
            <h2 className="mt-3 text-lg font-semibold">
              {c.name} <span className="text-sm font-normal text-[var(--color-plum-soft)]">({c.numeral})</span>
            </h2>
            <p className="mt-2 text-sm leading-relaxed">{c.interpretation}</p>
            <p className="mt-2 text-sm italic text-[var(--color-plum-soft)]">{c.focusNote}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-[var(--color-border)] bg-white/40 p-5">
        <p className="text-sm font-medium text-[var(--color-bronze)]">A question to sit with</p>
        <p className="prose-measure mt-2 text-lg">{result.reflection}</p>
      </div>

      <Link
        href="/"
        className="mt-10 inline-block min-h-11 rounded-lg bg-[var(--color-plum)] px-6 py-3 text-sm font-medium text-[var(--color-ivory)]"
      >
        Begin another reading
      </Link>
    </div>
  );
}
