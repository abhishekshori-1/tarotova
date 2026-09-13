"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
      setError("Something went wrong starting your reading. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 sm:py-20">
      <h1 className="text-3xl font-semibold sm:text-4xl">What is asking for your attention?</h1>
      <p className="prose-measure mt-4 text-lg text-[var(--color-plum-soft)]">
        Bring a question. Choose three cards. Find a perspective to sit with.
      </p>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          start(true);
        }}
      >
        <label htmlFor="question" className="block text-sm font-medium">
          Your question <span className="font-normal text-[var(--color-plum-soft)]">(optional)</span>
        </label>
        <textarea
          id="question"
          value={question}
          maxLength={QUESTION_MAX}
          rows={3}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Write it in your own words…"
          className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-white/60 px-3 py-2 text-base"
        />
        <div className="mt-1 flex justify-between text-xs text-[var(--color-plum-soft)]">
          <span>Shown with your reading, in your words.</span>
          <span aria-live="polite">
            {question.length}/{QUESTION_MAX}
          </span>
        </div>

        <p className="mt-4 text-xs font-medium text-[var(--color-plum-soft)]">Or start from an example — you can edit it</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                if (!question.trim() || window.confirm("Replace the question you've written?")) setQuestion(example);
              }}
              className="min-h-11 rounded-full border border-[var(--color-border)] bg-white/40 px-4 text-left text-sm hover:border-[var(--color-plum)]"
            >
              {example}
            </button>
          ))}
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

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-lg bg-[var(--color-plum)] px-6 py-3 text-base font-medium text-[var(--color-ivory)] transition-opacity disabled:opacity-60"
          >
            {busy ? "Starting…" : "Choose my cards"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => start(false)}
            className="min-h-11 rounded-lg border border-[var(--color-border)] px-6 py-3 text-base disabled:opacity-60"
          >
            Explore a general reading
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>

      <p className="mt-6 text-sm text-[var(--color-plum-soft)]">
        Your first reading needs no email. Confirm your email to continue with more free readings.
      </p>

      <p className="prose-measure mt-10 text-sm text-[var(--color-plum-soft)]">
        Tarotova uses the Rider–Waite–Smith Major Arcana, upright only, in a Situation / Challenge / Guidance spread — one chosen
        tradition among several, not an internationally mandated method. This is offered for reflection and entertainment.
      </p>
    </div>
  );
}
