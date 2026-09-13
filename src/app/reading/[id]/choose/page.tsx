"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CardBackSlot } from "@/components/CardBackSlot";
import { getStatus, reshuffle, updateSelection, type ApiError, type ReadingStatus } from "@/lib/api";
import { verifyHref } from "@/lib/nextPath";

const SLOT_COUNT = 22;

export default function ChoosePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<ReadingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resultHref = `/reading/${id}/result`;

  const load = useCallback(async () => {
    try {
      const s = await getStatus(id);
      if (s.state !== "drafting") return router.replace(s.entitlement === "granted" ? resultHref : verifyHref(resultHref));
      // The continuation gate comes before card selection (docs/ACCESS-FLOW.md section 2).
      if (s.entitlement === "verification_required") return router.replace(verifyHref(`/reading/${id}/choose`));
      setStatus(s);
    } catch {
      setError("This reading couldn't be found. It may have expired.");
    }
  }, [id, resultHref, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is the intended pattern for this build's plain client-fetch pages
    load();
  }, [load]);

  async function toggleSlot(slot: number) {
    if (!status || busy) return;
    setBusy(true);
    setError(null);
    const already = status.selectedSlots.includes(slot);
    const nextSlots = already ? status.selectedSlots.filter((s) => s !== slot) : [...status.selectedSlots, slot].slice(0, 3);
    try {
      setStatus(await updateSelection(id, status.revision, nextSlots));
    } catch (e) {
      if ((e as ApiError).status === 409) await load();
      else setError("Couldn't save your selection. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function clearSelection() {
    if (!status || busy) return;
    setBusy(true);
    try {
      setStatus(await updateSelection(id, status.revision, []));
    } finally {
      setBusy(false);
    }
  }

  async function shuffle() {
    if (!status || busy) return;
    setBusy(true);
    setError(null);
    try {
      setStatus(await reshuffle(id, status.revision));
    } catch {
      setError("Couldn't reshuffle right now.");
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    if (!status || status.selectedSlots.length !== 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await updateSelection(id, status.revision, status.selectedSlots, { lock: true });
      setStatus(s);
      // A lost race with another tab locks the draw but grants nothing;
      // verification then unlocks this same reading.
      router.push(s.entitlement === "granted" ? resultHref : verifyHref(resultHref));
    } catch (e) {
      if ((e as ApiError).status === 409) {
        setError("This reading changed in another tab. Your cards are shown as they are now.");
        await load();
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

  const canShuffle = status.selectedSlots.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 pb-32">
      <p className="text-sm text-[var(--color-bronze)]">Your question</p>
      <p className="prose-measure mt-1 text-lg">{status.question ?? "A general reading"}</p>

      <h1 className="mt-6 text-2xl font-semibold">Choose three cards</h1>
      <p className="mt-2 text-sm text-[var(--color-plum-soft)]" aria-live="polite">
        {status.selectedSlots.length} of 3 selected — Situation, Challenge, Guidance, in the order you choose them
      </p>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={shuffle}
          disabled={!canShuffle || busy}
          className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 text-sm disabled:opacity-40"
        >
          Shuffle
        </button>
        {status.selectedSlots.length > 0 && (
          <button type="button" onClick={clearSelection} disabled={busy} className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 text-sm">
            Clear selection
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
          const order = status.selectedSlots.includes(slot) ? status.selectedSlots.indexOf(slot) + 1 : undefined;
          const disabled = order === undefined && status.selectedSlots.length >= 3;
          return <CardBackSlot key={slot} slot={slot} order={order} disabled={disabled || busy} onClick={() => toggleSlot(slot)} />;
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--color-border)] bg-[var(--color-ivory)]/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <span className="text-sm">{status.selectedSlots.length} of 3 selected</span>
          <button
            type="button"
            onClick={reveal}
            disabled={status.selectedSlots.length !== 3 || busy}
            className="min-h-11 rounded-lg bg-[var(--color-plum)] px-6 text-sm font-medium text-[var(--color-ivory)] disabled:opacity-40"
          >
            Reveal these cards
          </button>
        </div>
      </div>
    </div>
  );
}
