"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CardBackSlot } from "@/components/CardBackSlot";
import { ReadingProgress } from "@/components/ReadingProgress";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/TurnstileWidget";
import { getStatus, reshuffle, updateSelection, type ApiError, type ReadingStatus } from "@/lib/api";
import { verifyHref } from "@/lib/nextPath";
import { createSaveQueue, type SaveState } from "@/lib/saveQueue";

const SLOT_COUNT = 22;
const POSITIONS = ["Situation", "Challenge", "Guidance"] as const;
const TURNSTILE_CONFIGURED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function ChoosePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  // Acknowledged server state vs. what the person has chosen: taps update
  // `selected` immediately; saves trail behind through the queue.
  const [status, setStatus] = useState<ReadingStatus | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const revisionRef = useRef(0);

  const resultHref = `/reading/${id}/result`;

  const load = useCallback(async () => {
    try {
      const s = await getStatus(id);
      if (s.state !== "drafting") return router.replace(s.entitlement === "granted" ? resultHref : verifyHref(resultHref));
      // The continuation gate comes before card selection (docs/ACCESS-FLOW.md section 2).
      if (s.entitlement === "verification_required") return router.replace(verifyHref(`/reading/${id}/choose`));
      revisionRef.current = s.revision;
      setStatus(s);
      setSelected(s.selectedSlots);
    } catch {
      setError("This reading isn't here anymore. It may have expired.");
    }
  }, [id, resultHref, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is the intended pattern for this build's plain client-fetch pages
    load();
  }, [load]);

  const queue = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- the ref is only read inside `save`, which runs from event handlers, never during render
      createSaveQueue<number[]>({
        save: async (slots) => {
          const s = await updateSelection(id, revisionRef.current, slots);
          revisionRef.current = s.revision;
          setStatus(s);
        },
        onStateChange: setSaveState,
        onError: async (e) => {
          if ((e as ApiError).status === 409) {
            setError("This reading changed in another tab. Your cards are shown as they are now.");
            await load();
          } else {
            setError("Your last choice isn't saved yet.");
          }
        },
      }),
    [id, load],
  );

  function toggleSlot(slot: number) {
    if (!status || busy) return;
    setError(null);
    const next = selected.includes(slot) ? selected.filter((s) => s !== slot) : [...selected, slot].slice(0, 3);
    setSelected(next);
    queue.push(next);
  }

  function clearSelection() {
    if (!status || busy) return;
    setError(null);
    setSelected([]);
    queue.push([]);
  }

  async function shuffle() {
    if (!status || busy || selected.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await queue.flush();
      const s = await reshuffle(id, revisionRef.current);
      revisionRef.current = s.revision;
      setStatus(s);
    } catch (e) {
      if ((e as ApiError).status === 409) await load();
      else setError("Couldn't reshuffle right now.");
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    if (!status || selected.length !== 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Lock only the acknowledged selection: wait for queued saves first.
      await queue.flush();
      const s = await updateSelection(id, revisionRef.current, selected, { lock: true, turnstileToken });
      setStatus(s);
      // A lost race with another tab locks the draw but grants nothing;
      // verification then unlocks this same reading.
      router.push(s.entitlement === "granted" ? resultHref : verifyHref(resultHref));
    } catch (e) {
      if ((e as ApiError).status === 409) {
        setError("This reading changed in another tab. Your cards are shown as they are now.");
        await load();
      } else if (queue.state === "failed") {
        setError("Your picks aren't saved yet. Retry saving, then turn them over.");
      } else if ((e as ApiError).body?.error === "bot_check_failed") {
        setError("That check expired. Do it once more, then turn them over.");
      } else if ((e as ApiError).body?.error === "bot_check_not_configured") {
        setError("Can't turn cards over right now. Try again in a bit.");
      } else setError("Couldn't turn them over. Try again.");
      // Turnstile tokens are single-use; a failed lock needs a fresh one.
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  if (error && !status) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-lg">{error}</p>
        <Link href="/" className="mt-4 inline-block underline">
          Start a new reading
        </Link>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-[var(--fg-soft)]" aria-live="polite">
        Loading your deck…
      </div>
    );
  }

  const canShuffle = selected.length === 0 && saveState !== "failed";
  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "failed" ? "Not saved" : "Saved";
  // The email-free reveal carries the bot check a verified session already passed (docs/REVIEW-V2.md finding 2).
  const needsBotCheck = TURNSTILE_CONFIGURED && !status.sessionVerified;
  const canReveal = selected.length === 3 && !busy && saveState !== "failed" && (!needsBotCheck || turnstileToken !== null);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-44 pt-8">
      <ReadingProgress current={1} />
      <p className="eyebrow mt-6">Your question</p>
      <p className="prose-measure mt-1 text-lg">{status.question ?? "No question. Reading cold."}</p>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="title">Pull three cards</h1>
          <p className="mt-1 text-sm text-[var(--fg-soft)]">Tap three, in order. Where you are, what&apos;s in the way, the way through.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={shuffle} disabled={!canShuffle || busy} className="btn-secondary px-4 text-sm">
            Shuffle
          </button>
          {selected.length > 0 && (
            <button type="button" onClick={clearSelection} disabled={busy} className="btn-secondary px-4 text-sm">
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6 sm:gap-4 xl:grid-cols-8">
        {Array.from({ length: SLOT_COUNT }, (_, slot) => {
          const order = selected.includes(slot) ? selected.indexOf(slot) + 1 : undefined;
          const disabled = order === undefined && selected.length >= 3;
          return <CardBackSlot key={slot} slot={slot} order={order} disabled={disabled || busy} onClick={() => toggleSlot(slot)} />;
        })}
      </div>

      {needsBotCheck && (
        <div className="mt-8">
          <p className="text-sm text-[var(--fg-soft)]">One quick check that you&apos;re a person. No email, just this.</p>
          <div className="mt-2">
            <TurnstileWidget ref={turnstileRef} onToken={setTurnstileToken} />
          </div>
        </div>
      )}

      <div className="sticky-tray fixed inset-x-0 bottom-0 border-t border-[var(--line)] bg-[rgba(20,17,31,0.92)] px-4 pt-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <ol className="flex items-center gap-3" aria-label="Your three positions">
            {POSITIONS.map((label, i) => {
              const filled = selected[i] !== undefined;
              return (
                <li key={label} className="flex flex-col items-center gap-1">
                  <div
                    className={`relative aspect-[5/8] w-10 rounded-md border ${filled ? "border-[var(--gold)]" : "border-dashed border-[var(--line)]"}`}
                    aria-hidden="true"
                  >
                    {filled && <Image src="/cards/back.svg" alt="" fill sizes="40px" className="rounded-md" />}
                  </div>
                  <span className={`text-[0.65rem] ${filled ? "text-[var(--fg)]" : "text-[var(--fg-soft)]"}`}>{label}</span>
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--fg-soft)]" aria-live="polite">
              {saveLabel}
            </span>
            {saveState === "failed" && (
              <button type="button" onClick={() => queue.retry()} className="min-h-11 text-sm underline">
                Retry saving
              </button>
            )}
            <button type="button" onClick={reveal} disabled={!canReveal} className="btn-primary px-6 text-sm">
              {busy ? "Hold on…" : "Turn them over"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
