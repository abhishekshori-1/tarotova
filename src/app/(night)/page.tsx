"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createReading } from "@/lib/api";
import { verifyHref } from "@/lib/nextPath";
import { FOCUS_META, DEFAULT_FOCUS } from "@/content/focuses";
import { FOCUSES, type Focus } from "@/content/types";

const QUESTION_MAX = 500;

const EXAMPLES = [
  "What should I consider before changing jobs?",
  "How can I approach this conversation with more clarity?",
  "What pattern am I ready to change?",
  "What deserves my attention right now?",
];

const STEPS: [string, string][] = [
  ["Ask", "Say what's going on, in your own words. Or don't, and I'll read cold."],
  ["Pull", "Three cards, face down. Where you are, what's in the way, the way through."],
  ["Read", "Each card in its place, then one thing to take out the door with you."],
];

export default function Home() {
  const router = useRouter();
  const [focus, setFocus] = useState<Focus>(DEFAULT_FOCUS);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(withQuestion: boolean) {
    setBusy(true);
    setError(null);
    try {
      const reading = await createReading(focus, withQuestion ? question.trim() : undefined);
      const choose = `/reading/${reading.id}/choose`;
      router.push(reading.entitlement === "verification_required" ? verifyHref(choose) : choose);
    } catch {
      setError("Couldn't get the deck out. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-16">
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <section className="settle-in">
          <h1 className="display">What&apos;s on your mind?</h1>
          <p className="prose-measure mt-5 text-lg text-[var(--fg-soft)]">Ask it plainly. Pull three cards. See what they have to say.</p>

          <form
            className="mt-10"
            onSubmit={(e) => {
              e.preventDefault();
              start(true);
            }}
          >
            <label htmlFor="question" className="block text-sm font-medium">
              Your question <span className="font-normal text-[var(--fg-soft)]">(optional)</span>
            </label>
            <textarea
              id="question"
              value={question}
              maxLength={QUESTION_MAX}
              rows={3}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Say it the way you'd say it to a friend…"
              className="field mt-2 resize-y"
            />
            <div className="mt-1 flex justify-between text-xs text-[var(--fg-soft)]">
              <span>Your words, kept with your reading.</span>
              <span aria-live="polite">
                {question.length}/{QUESTION_MAX}
              </span>
            </div>

            <p className="mt-5 text-xs font-medium text-[var(--fg-soft)]">Or borrow one of these and make it yours</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    if (!question.trim() || window.confirm("Replace the question you've written?")) setQuestion(example);
                  }}
                  className="chip"
                >
                  {example}
                </button>
              ))}
            </div>

            <fieldset className="mt-8">
              <legend className="text-sm font-medium text-[var(--fg-soft)]">What&apos;s this about?</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {FOCUSES.map((f) => (
                  <button key={f} type="button" onClick={() => setFocus(f)} aria-pressed={focus === f} className="chip">
                    {FOCUS_META[f].label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="submit" disabled={busy} className="btn-primary px-6 py-3 text-base">
                {busy ? "One moment…" : "Pull my cards"}
              </button>
              <button type="button" disabled={busy} onClick={() => start(false)} className="btn-secondary px-6 py-3 text-base">
                Just read for me
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-300">
                {error}
              </p>
            )}
          </form>

          <p className="mt-6 text-sm text-[var(--fg-soft)]">First reading&apos;s on the house, no email. After that, one code to keep going.</p>
        </section>

        <aside className="relative mx-auto hidden aspect-[4/3] w-full max-w-md lg:block" aria-hidden="true">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(172,155,203,0.18),transparent_65%)]" />
          {[-12, 0, 12].map((deg, i) => (
            <div
              key={deg}
              className="card-frame settle-in absolute left-1/2 top-1/2 w-40"
              style={{
                transform: `translate(-50%, -50%) translateX(${(i - 1) * 84}px) rotate(${deg}deg)`,
                animationDelay: `${120 + i * 90}ms`,
                zIndex: i === 1 ? 2 : 1,
              }}
            >
              <div className="relative aspect-[5/8] w-full">
                <Image src="/cards/back.svg" alt="" fill sizes="160px" priority className="rounded-[0.6rem]" />
              </div>
            </div>
          ))}
        </aside>
      </div>

      <section className="mt-20 grid gap-8 border-t border-[var(--line)] pt-10 sm:grid-cols-3">
        {STEPS.map(([title, text], i) => (
          <div key={title}>
            <p className="eyebrow">Step {i + 1}</p>
            <h2 className="mt-2 text-xl">{title}</h2>
            <p className="mt-2 text-sm text-[var(--fg-soft)]">{text}</p>
          </div>
        ))}
      </section>

      <p className="prose-measure mt-12 text-sm text-[var(--fg-soft)]">
        Tarotova uses the Rider–Waite–Smith Major Arcana, upright only, in a Situation / Challenge / Guidance spread — one chosen
        tradition among several, not an internationally mandated method. This is offered for reflection and entertainment.
      </p>
    </div>
  );
}
