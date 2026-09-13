"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReading } from "@/lib/api";
import { FOCUS_META, DEFAULT_FOCUS } from "@/content/focuses";
import { FOCUSES, type Focus } from "@/content/types";

export default function Home() {
  const router = useRouter();
  const [focus, setFocus] = useState<Focus>(DEFAULT_FOCUS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const reading = await createReading();
      if (focus !== DEFAULT_FOCUS) {
        await fetch(`/api/readings/${reading.id}/selection`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: reading.revision, slots: [], lock: false, focus }),
        });
      }
      router.push(`/reading/${reading.id}/choose`);
    } catch {
      setError("Something went wrong starting your reading. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 sm:py-20">
      <h1 className="text-3xl font-semibold sm:text-4xl">A calm three-card reading</h1>
      <p className="prose-measure mt-4 text-lg text-[var(--color-plum-soft)]">
        Choose three cards from the Major Arcana. Read them as Situation, Challenge, and Guidance — a
        moment to reflect, not a prediction.
      </p>

      <div className="mt-8 rounded-lg border border-[var(--color-border)] bg-white/40 p-4 text-sm">
        Free three-card reading. You&apos;ll confirm your email before your cards and interpretation are
        revealed.
      </div>

      <fieldset className="mt-8">
        <legend className="text-sm font-medium text-[var(--color-plum-soft)]">What&apos;s this reading about?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {FOCUSES.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFocus(f)}
              aria-pressed={focus === f}
              className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
                focus === f
                  ? "border-[var(--color-plum)] bg-[var(--color-plum)] text-[var(--color-ivory)]"
                  : "border-[var(--color-border)] bg-white/40 hover:border-[var(--color-plum)]"
              }`}
            >
              {FOCUS_META[f].label}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="mt-10 min-h-11 w-full rounded-lg bg-[var(--color-plum)] px-6 py-3 text-base font-medium text-[var(--color-ivory)] transition-opacity disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Starting…" : "Choose my cards"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <p className="prose-measure mt-10 text-sm text-[var(--color-plum-soft)]">
        Tarotova uses the Rider–Waite–Smith Major Arcana, upright only, in a Situation / Challenge /
        Guidance spread — one chosen tradition among several, not an internationally mandated method. This
        is offered for reflection and entertainment.
      </p>
    </div>
  );
}
