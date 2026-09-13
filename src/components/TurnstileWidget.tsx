"use client";

import { useId } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; theme?: "light" | "dark" | "auto" },
      ) => string;
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
 */
export function TurnstileWidget({ onToken }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerId = useId().replace(/[^a-zA-Z0-9-]/g, "");

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onReady={() => {
          window.turnstile?.render(`#${containerId}`, {
            sitekey: siteKey,
            callback: (token) => onToken(token),
            "expired-callback": () => onToken(null),
          });
        }}
      />
      <div id={containerId} />
    </>
  );
}
