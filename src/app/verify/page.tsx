"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSession, requestSessionCode, type ApiError } from "@/lib/api";
import { safeNextPath } from "@/lib/nextPath";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/TurnstileWidget";

const TURNSTILE_CONFIGURED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function VerifyPage() {
  return (
    <Suspense fallback={<Loading />}>
      <VerifyForm />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center text-[var(--color-plum-soft)]" aria-live="polite">
      Loading…
    </div>
  );
}

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const codeHref = `/verify/code?next=${encodeURIComponent(next)}`;
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const load = useCallback(async () => {
    try {
      const s = await getSession();
      if (s.verified) return router.replace(next);
    } catch {
      // Fall through to the form; the request itself reports real problems.
    }
    setReady(true);
  }, [next, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is the intended pattern for this build's plain client-fetch pages
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await requestSessionCode(email, turnstileToken);
      if (res.devCode) sessionStorage.setItem("tarotova_devcode_session", res.devCode);
      router.push(codeHref);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 429) {
        const seconds = err.retryAfterSeconds;
        const wait = seconds ? (seconds < 60 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`) : "a little while";
        setError(`Too many attempts right now. Please try again in ${wait}.`);
      } else if (err.body?.error === "address_suppressed") setError("We can't send to this address right now.");
      else if (err.body?.error === "email_not_configured" || err.body?.error === "email_send_failed" || err.body?.error === "bot_check_not_configured") {
        setError("We couldn't send your email. Please try again later.");
      } else if (err.body?.error === "bot_check_failed") setError("The security check expired. Please complete it again.");
      else setError("Couldn't send the code. Please check the address and try again.");
      // Turnstile tokens are single-use; get a fresh one for the retry.
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <Loading />;

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold">Keep exploring with Tarotova</h1>
      <p className="prose-measure mt-3 text-[var(--color-plum-soft)]">
        Your first reading needed no email. To begin another, confirm your email once — we&apos;ll send a one-time code, and this
        browser stays confirmed for 30 days.
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
        <TurnstileWidget ref={turnstileRef} onToken={setTurnstileToken} />
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

      <p className="mt-4 text-xs text-[var(--color-plum-soft)]">This won&apos;t subscribe you to marketing.</p>
      <p className="mt-6 text-sm">
        <Link href="/" className="underline">
          Return to my reading
        </Link>
      </p>
    </div>
  );
}
