"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getStatus, sendOtp, type ReadingStatus } from "@/lib/api";
import { TurnstileWidget } from "@/components/TurnstileWidget";

const TURNSTILE_CONFIGURED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function EmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<ReadingStatus | null>(null);
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getStatus(id);
      setStatus(s);
      if (s.state === "drafting") router.replace(`/reading/${id}/choose`);
      if (s.state === "verified") router.replace(`/reading/${id}/result`);
    } catch {
      setNotFound(true);
    }
  }, [id, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is the intended pattern for this build's plain client-fetch pages
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!status || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await sendOtp(id, status.revision, email, "send", turnstileToken);
      if (res.devCode) {
        // Dev-mode-only convenience (no email account configured): stash the
        // code so the confirm page can display it. Never set in a
        // production build — the server only returns devCode when
        // NODE_ENV !== "production".
        sessionStorage.setItem(`tarotova_devcode_${id}`, res.devCode);
      }
      router.push(`/reading/${id}/confirm`);
    } catch (e) {
      const err = e as { status?: number; body?: { error?: string } };
      if (err.status === 429) setError("Too many attempts right now. Please try again shortly.");
      else if (err.body?.error === "address_suppressed") setError("We can't send to this address right now.");
      else setError("Couldn't send the code. Please check the address and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-lg">This reading couldn&apos;t be found. It may have expired.</p>
        <Link href="/" className="mt-4 inline-block underline">
          Start a new reading
        </Link>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-[var(--color-plum-soft)]" aria-live="polite">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold">Confirm your email</h1>

      <div className="mt-6 flex justify-center gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative aspect-[5/8] w-20">
            <Image src="/cards/back.svg" alt="" fill sizes="80px" />
          </div>
        ))}
      </div>

      <p className="prose-measure mt-6 text-sm text-[var(--color-plum-soft)]">
        We&apos;ll email you a one-time code to reveal this reading. This does not subscribe you to
        marketing.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label htmlFor="email" className="block text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white/60 px-3 text-base"
        />
        <TurnstileWidget onToken={setTurnstileToken} />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || (TURNSTILE_CONFIGURED && !turnstileToken)}
          className="min-h-11 w-full rounded-lg bg-[var(--color-plum)] px-6 text-sm font-medium text-[var(--color-ivory)] disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send my code"}
        </button>
      </form>
    </div>
  );
}
