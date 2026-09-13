"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; theme?: "light" | "dark" | "auto" },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

interface Props {
  onToken: (token: string | null) => void;
}

/**
 * Renders Cloudflare Turnstile when a site key is configured (PLAN.md
 * section 5/6). With no `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set — the default
 * until a Cloudflare account exists — this renders nothing, matching the
 * server's own skip-with-warning behavior (src/server/turnstile.ts) so dev
 * and account-less deploys stay usable.
 *
 * `next/script`'s `onReady` fires on every mount of this component, not just
 * once when the script first loads (that's intentional on Next's part, for
 * client-side navigations) — calling `turnstile.render()` unconditionally
 * there re-renders into the same container without removing the previous
 * widget first, which Turnstile logs as "Cannot find Widget ...". Guard with
 * a ref so we render at most once per mounted instance, and explicitly
 * `remove()` the widget on unmount.
 */
export function TurnstileWidget({ onToken }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    renderOnce();
    return () => {
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderOnce() {
    if (!siteKey || !window.turnstile || !containerRef.current || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(null),
    });
  }

  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer onReady={renderOnce} />
      <div ref={containerRef} />
    </>
  );
}
