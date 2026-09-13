"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CardBackSlot } from "@/components/CardBackSlot";
import { getStatus, reshuffle, updateSelection, type ApiError, type ReadingStatus } from "@/lib/api";
import { verifyHref } from "@/lib/nextPath";
import { createSaveQueue, type SaveState } from "@/lib/saveQueue";

const SLOT_COUNT = 22;

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
      setError("This reading couldn't be found. It may have expired.");
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
            // Another tab moved the reading on; show the server's state and
            // let the person reapply what they meant.
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
      const s = await updateSelection(id, revisionRef.current, selected, { lock: true });
      setStatus(s);
      // A lost race with another tab locks the draw but grants nothing;
      // verification then unlocks this same reading.
      router.push(s.entitlement === "granted" ? resultHref : verifyHref(resultHref));
    } catch (e) {
      if ((e as ApiError).status === 409) {
        setError("This reading changed in another tab. Your cards are shown as they are now.");
        await load();
      } else if (queue.state === "failed") {
        setError("Your choices aren't saved yet. Retry saving, then reveal.");
      } else setError("Couldn't lock your selection. Please try again.");
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
      <div className="mx-auto max-w-md px-6 py-16 text-center text-[var(--color-plum-soft)]" aria-live="polite">
        Loading your deck…
      </div>
    );
  }

  const canShuffle = selected.length === 0 && saveState !== "failed";
  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "failed" ? "Not saved" : "Saved";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 pb-32">
      <p className="text-sm text-[var(--color-bronze)]">Your question</p>
      <p className="prose-measure mt-1 text-lg">{status.question ?? "A general reading"}</p>

      <h1 className="mt-6 text-2xl font-semibold">Choose three cards</h1>
      <p className="mt-2 text-sm text-[var(--color-plum-soft)]" aria-live="polite">
        {selected.length} of 3 selected — Situation, Challenge, Guidance, in the order you choose them
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={shuffle}
          disabled={!canShuffle || busy}
          className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 text-sm disabled:opacity-40"
        >
          Shuffle
        </button>
        {selected.length > 0 && (
          <button type="button" onClick={clearSelection} disabled={busy} className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 text-sm">
            Clear selection
          </button>
        )}
        <span className="text-xs text-[var(--color-plum-soft)]" aria-live="polite">
          {saveLabel}
        </span>
        {saveState === "failed" && (
          <button type="button" onClick={() => queue.retry()} className="min-h-11 text-sm underline">
            Retry saving
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6">
        {Array.from({ length: SLOT_COUNT }, (_, slot) => {
          const order = selected.includes(slot) ? selected.indexOf(slot) + 1 : undefined;
          const disabled = order === undefined && selected.length >= 3;
          return <CardBackSlot key={slot} slot={slot} order={order} disabled={disabled || busy} onClick={() => toggleSlot(slot)} />;
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--color-border)] bg-[var(--color-ivory)]/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <span className="text-sm">{selected.length} of 3 selected</span>
          <button
            type="button"
            onClick={reveal}
            disabled={selected.length !== 3 || busy || saveState === "failed"}
            className="min-h-11 rounded-lg bg-[var(--color-plum)] px-6 text-sm font-medium text-[var(--color-ivory)] disabled:opacity-40"
          >
            {busy ? "Saving your choices…" : "Reveal these cards"}
          </button>
        </div>
      </div>
    </div>
  );
}
