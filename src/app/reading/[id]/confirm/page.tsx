"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CodeInput } from "@/components/CodeInput";
import { getStatus, verifyCode, type ReadingStatus } from "@/lib/api";

function useCountdown(targetMs: number | undefined) {
  const [remaining, setRemaining] = useState(() => (targetMs ? Math.max(0, targetMs - Date.now()) : 0));
  useEffect(() => {
    if (!targetMs) return;
    const t = setInterval(() => setRemaining(Math.max(0, targetMs - Date.now())), 1000);
    return () => clearInterval(t);
  }, [targetMs]);
  return remaining;
}

export default function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<ReadingStatus | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getStatus(id);
      setStatus(s);
      if (s.state === "drafting") router.replace(`/reading/${id}/choose`);
      if (s.state === "verified") router.replace(`/reading/${id}/result`);
      if (s.state === "locked" && !s.pendingChallenge) router.replace(`/reading/${id}/email`);
    } catch {
      setNotFound(true);
    }
  }, [id, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is the intended pattern for this build's plain client-fetch pages
    load();
  }, [load]);

  useEffect(() => {
    const stashed = sessionStorage.getItem(`tarotova_devcode_${id}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time dev-mode convenience read, not a data sync loop
    if (stashed) setDevCode(stashed);
  }, [id]);

  const resendRemaining = useCountdown(status?.pendingChallenge?.resendAvailableAt);
  const expiryRemaining = useCountdown(status?.pendingChallenge?.expiresAt);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!status || busy || code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(id, code);
      router.push(`/reading/${id}/result`);
    } catch (e) {
      const err = e as { body?: { reason?: string } };
      const reason = err.body?.reason;
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

  async function resend() {
    if (!status || busy || resendRemaining > 0) return;
    setBusy(true);
    setError(null);
    try {
      const email = status.maskedEmail ?? "";
      // Masked email isn't enough to resend to the right address in a real
      // deployment; this dev build re-sends via the same intended email the
      // server already has on the current challenge.
      const res = await fetch(`/api/readings/${id}/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: status.revision, email, intent: "resend" }),
      });
      if (res.ok) {
        const body = await res.json();
        if (body.devCode) setDevCode(body.devCode);
      }
      await load();
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
      <h1 className="text-2xl font-semibold">Enter your code</h1>
      <p className="mt-2 text-sm text-[var(--color-plum-soft)]">
        We sent a 6-digit code to {status.maskedEmail ?? "your email"}.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <CodeInput value={code} onChange={setCode} disabled={busy} />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="min-h-11 w-full rounded-lg bg-[var(--color-plum)] px-6 text-sm font-medium text-[var(--color-ivory)] disabled:opacity-60"
        >
          {busy ? "Checking…" : "Confirm and reveal"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-plum-soft)]">
        <button type="button" onClick={resend} disabled={resendRemaining > 0 || busy} className="underline disabled:no-underline disabled:opacity-60">
          {resendRemaining > 0 ? `Resend available in ${Math.ceil(resendRemaining / 1000)}s` : "Resend code"}
        </button>
        <Link href={`/reading/${id}/email`} className="underline">
          Change email
        </Link>
      </div>

      {expiryRemaining > 0 && expiryRemaining < 2 * 60 * 1000 && (
        <p className="mt-3 text-xs text-[var(--color-plum-soft)]">Code expires in {Math.ceil(expiryRemaining / 1000)}s.</p>
      )}

      {devCode && (
        <p className="mt-6 rounded-lg border border-dashed border-[var(--color-bronze)] bg-white/50 p-3 text-xs">
          Dev mode (no email account configured): your code is <strong className="font-mono text-sm">{devCode}</strong>.
        </p>
      )}
    </div>
  );
}
