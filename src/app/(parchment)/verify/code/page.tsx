"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CodeInput } from "@/components/CodeInput";
import { confirmSessionCode, getSession, type ApiError, type SessionVerification } from "@/lib/api";
import { safeNextPath, verifyHref } from "@/lib/nextPath";

function useCountdown(targetMs: number | undefined) {
  const [remaining, setRemaining] = useState(() => (targetMs ? Math.max(0, targetMs - Date.now()) : 0));
  useEffect(() => {
    if (!targetMs) return;
    const t = setInterval(() => setRemaining(Math.max(0, targetMs - Date.now())), 1000);
    return () => clearInterval(t);
  }, [targetMs]);
  return remaining;
}

export default function CodePage() {
  return (
    <Suspense fallback={<Loading />}>
      <CodeForm />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center text-[var(--fg-soft)]" aria-live="polite">
      Loading…
    </div>
  );
}

function CodeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [session, setSession] = useState<SessionVerification | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getSession();
      if (s.verified) return router.replace(next);
      if (!s.pendingChallenge) return router.replace(verifyHref(next));
      setSession(s);
    } catch {
      router.replace(verifyHref(next));
    }
  }, [next, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is the intended pattern for this build's plain client-fetch pages
    load();
  }, [load]);

  useEffect(() => {
    const stashed = sessionStorage.getItem("tarotova_devcode_session");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time dev-mode convenience read, not a data sync loop
    if (stashed) setDevCode(stashed);
  }, []);

  const resendRemaining = useCountdown(session?.pendingChallenge?.resendAvailableAt);
  const expiryRemaining = useCountdown(session?.pendingChallenge?.expiresAt);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || busy || code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await confirmSessionCode(code);
      sessionStorage.removeItem("tarotova_devcode_session");
      router.replace(next);
    } catch (e) {
      const reason = (e as ApiError).body?.reason;
      if (reason === "expired") setError("That code has expired. Request a new one below.");
      else if (reason === "attempts_exhausted") setError("Too many wrong attempts. Request a new code below.");
      else if (reason === "no_active_code") setError("No active code. Request a new one below.");
      else setError("That code wasn't right. Please try again.");
      setCode("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <Loading />;

  const sendStatus = session.pendingChallenge?.sendStatus;

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="title">Your code</h1>
      <p className="mt-2 text-sm text-[var(--fg-soft)]">
        {sendStatus === "accepted"
          ? `Check ${session.maskedEmail ?? "your email"} for a 6-digit code.`
          : sendStatus === "failed"
            ? "We couldn't send your code. Please request a new one below."
            : "We couldn't confirm whether your code was sent. If it arrives, you can enter it here; otherwise, request a new one below."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <CodeInput value={code} onChange={setCode} disabled={busy} />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || code.length !== 6} className="btn-primary w-full px-6 text-sm">
          {busy ? "Checking…" : "Confirm and continue"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm text-[var(--fg-soft)]">
        <button
          type="button"
          onClick={() => router.push(verifyHref(next))}
          disabled={resendRemaining > 0 || busy}
          className="underline disabled:no-underline disabled:opacity-60"
        >
          {resendRemaining > 0 ? `Resend available in ${Math.ceil(resendRemaining / 1000)}s` : "Request a new code"}
        </button>
        <Link href={verifyHref(next)} className="underline">
          Change email
        </Link>
      </div>

      {expiryRemaining > 0 && expiryRemaining < 2 * 60 * 1000 && (
        <p className="mt-3 text-xs text-[var(--fg-soft)]">Code expires in {Math.ceil(expiryRemaining / 1000)}s.</p>
      )}

      {devCode && (
        <p className="mt-6 rounded-lg border border-dashed border-[var(--color-bronze)] bg-white/50 p-3 text-xs">
          Dev mode (no email account configured): your code is <strong className="font-mono text-sm">{devCode}</strong>.
        </p>
      )}
    </div>
  );
}
