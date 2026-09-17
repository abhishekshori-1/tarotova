"use client";

import { useHydrated } from "@/lib/useHydrated";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { CardBack, CardFace } from "@/components/CardArt";
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
  ["Read", "Each card in its place, how they connect, then one thing to take out the door with you."],
];

/**
 * The public hero cards are illustrative studies (The Star, a card back,
 * The Fool). They have no relationship to any visitor's private draw
 * (docs/PLAN-EXTENDED.md section 3).
 */
const HERO = [
  { id: "major-17-star", name: "The Star" },
  null,
  { id: "major-00-fool", name: "The Fool" },
] as const;

export function HomeExperience({ journeys }: { journeys: ReactNode }) {
  const router = useRouter();
  const ready = useHydrated();
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

  const fan = (
    <div className="hero-fan mx-auto w-full max-w-md" aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(172,155,203,0.2),transparent_65%)]" />
      {HERO.map((card, i) => (
        <div key={card?.id ?? "back"} className="hero-fan-card fade-in card-frame" style={{ ["--fan-i" as string]: String(i - 1), animationDelay: `${120 + i * 90}ms`, zIndex: i === 1 ? 2 : 1 }}>
          {card ? <CardFace id={card.id} name={card.name} alt="" sizes="160px" priority /> : <CardBack sizes="160px" priority />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-6 sm:px-6 sm:pt-12">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-14">
        {/* On phones the composition comes first, so the first viewport has a visual identity as well as an action. */}
        <div className="lg:hidden">{fan}</div>

        <section className="settle-in">
          <h1 className="display">What&apos;s on your mind?</h1>
          <p className="prose-measure mt-5 text-lg text-[var(--fg-soft)]">Ask it plainly. Pull three cards. Spend some time with what they have to say.</p>

          <form
            className="panel mt-8 p-5 sm:p-7"
            onSubmit={(e) => {
              e.preventDefault();
              start(true);
            }}
          >
            <label htmlFor="question" className="block text-base font-medium">
              Your question <span className="font-normal text-[var(--fg-soft)]">(optional)</span>
            </label>
            <textarea
              id="question"
              value={question}
              disabled={!ready || busy}
              maxLength={QUESTION_MAX}
              rows={4}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Say it the way you'd say it to a friend…"
              className="field mt-3 resize-y text-lg"
            />
            <div className="mt-2 flex justify-between text-xs text-[var(--fg-soft)]">
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

            <fieldset className="mt-7">
              <legend className="text-sm font-medium text-[var(--fg-soft)]">What&apos;s this about?</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {FOCUSES.map((f) => (
                  <button key={f} type="button" onClick={() => setFocus(f)} aria-pressed={focus === f} className="chip">
                    {FOCUS_META[f].label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="submit" disabled={!ready || busy} className="btn-primary px-6 py-3 text-base">
                {busy ? "One moment…" : "Pull my cards"}
              </button>
              <button type="button" disabled={!ready || busy} onClick={() => start(false)} className="btn-secondary px-6 py-3 text-base">
                Just read for me
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-300">
                {error}
              </p>
            )}
          </form>

          <p className="mt-5 text-sm text-[var(--fg-soft)]">First reading&apos;s on the house, no email. After that, one code to keep going.</p>
        </section>

        <aside className="hidden lg:block">{fan}</aside>
      </div>

      {journeys}

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
