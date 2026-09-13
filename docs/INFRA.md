# Infrastructure

What's actually deployed and how the pieces connect — written after the live
domain/hosting/email setup done in this session. Complements
`docs/IMPLEMENTATION.md` (what the *code* does/doesn't do) and `docs/PLAN.md`
(the original design). Update this when any account, region, or DNS record
changes — it's a snapshot, not a live dashboard.

## One-paragraph picture

A visitor hits `tarotova.com`, which Cloudflare resolves (Cloudflare is the
DNS host, not a proxy — traffic goes straight to Vercel) and redirects to
`www.tarotova.com`, served by a Vercel-hosted Next.js app. That app talks to
a Postgres database on Supabase (Tokyo region) for all state, calls Resend
(from a dedicated `mail.tarotova.com` sending subdomain) to deliver OTP
codes, and calls Cloudflare Turnstile to check for bots before sending.
GitHub is the source of truth; pushing to `main` auto-deploys to Vercel.

```
Visitor
  │
  ▼
Cloudflare (DNS host for tarotova.com — NOT proxied, "DNS only")
  │  A/CNAME records point straight at Vercel's edge
  ▼
Vercel (Next.js; hnd1 configured locally, deployment pending — see Known Issues)
  │                                  │
  ▼                                  ▼
Supabase Postgres (Tokyo)      Resend (mail.tarotova.com)  ──▶  Cloudflare Turnstile
  all app state                  OTP emails                     bot check before send
```

## Domain

| Item | Value |
| --- | --- |
| Registrar | Namecheap |
| Domain | `tarotova.com` |
| Registered | 2026-09-13, renews 2026-09-13/2027 (auto-renew on) |
| WHOIS privacy | On (WithheldForPrivacy) |
| Nameservers | `raquel.ns.cloudflare.com`, `santino.ns.cloudflare.com` (Cloudflare — switched from Namecheap's defaults) |

Namecheap's own "Redirect Domain" (`tarotova.com → www.tarotova.com`) and
"Redirect Email"/PremiumDNS features are **not** in use — they only apply
when Namecheap's own nameservers are authoritative, which they no longer are.

## DNS (Cloudflare — Free plan)

Cloudflare hosts DNS for `tarotova.com`. Every record below is **DNS
only** (grey cloud / not proxied) — deliberately, so Vercel's own TLS
certificate issuance and Resend's mail routing aren't affected by
Cloudflare's proxy layer. Only Turnstile (a separate product, not tied to
proxying) adds any Cloudflare-side traffic handling.

| Type | Name | Value | Purpose |
| --- | --- | --- | --- |
| A | `@` | `216.198.79.1` | Vercel apex — redirects (308) to `www` |
| CNAME | `www` | `f716c9aeda181f35.vercel-dns-017.com` | Vercel canonical serving domain |
| MX | `@` | `eforward1..5.registrar-servers.com` (prio 10-20) | Namecheap's free email forwarding — unrelated to the app, kept as-is |
| TXT | `@` | `v=spf1 include:spf.efwd.registrar-servers.com ~all` (approx.) | SPF for the Namecheap forwarding above |
| TXT | `resend._domainkey.mail` | DKIM public key | Resend DKIM signing for `mail.tarotova.com` |
| MX | `send.mail` | `feedback-smtp.ap-northeast-1.amazonses.com` (prio 10) | Resend's bounce/feedback loop (Resend runs on AWS SES) |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | SPF for Resend sending — isolated to `send.mail.tarotova.com` specifically so it can never conflict with the root domain's own SPF above |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DMARC, monitor-only policy, applies domain-wide |

Note the deliberate structure: Resend verifies against `mail.tarotova.com`,
but its SPF/MX records live on a further-nested `send.mail.tarotova.com` —
that's Resend's own pattern for guaranteeing no collision with whatever SPF
already exists on the domain you're verifying.

### Cloudflare Turnstile

- One widget, "Managed" mode, hostname `tarotova.com` (covers all
  subdomains automatically — Cloudflare's widget UI explicitly rejects
  entering a subdomain as a separate hostname).
- Site Key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (currently saved as Config
  in Vercel). Must be available at build time for Next.js to inline it into
  the browser bundle; changing it requires a new build.
- Secret Key → `TURNSTILE_SECRET_KEY` (Vercel, type **Secret**).
- Client widget: `src/components/TurnstileWidget.tsx`. Server check:
  `src/server/turnstile.ts`.

## Hosting (Vercel)

| Item | Value |
| --- | --- |
| Team | Mosho (Hobby plan) |
| Project | `tarotova` |
| Source | GitHub `abhishekshori-1/tarotova`, branch `main` — every push auto-deploys |
| Default domain | `tarotova.vercel.app` |
| Custom domains | `tarotova.com` (redirects to www), `www.tarotova.com` (canonical) |
| Framework | Next.js (App Router), root directory `./` |
| Runtime | Node.js serverless functions (not Edge, not Cloudflare Workers) |
| Function region | `vercel.json` now sets `hnd1` (Tokyo); deployment and live verification pending |

### Environment variables (Production)

| Variable | Type | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Secret | Supabase Postgres connection string (Transaction pooler mode) |
| `OTP_HMAC_SECRET` | Secret | HMAC key for OTP code digests |
| `OTP_HMAC_KEY_VERSION` | Config | Currently `1` |
| `SESSION_HASH_SECRET` | Secret | Session token hashing, email lookup hashing |
| `EMAIL_PROVIDER` | Config | `resend` |
| `RESEND_API_KEY` | Secret | Resend API key |
| `EMAIL_FROM` | Config | `Tarotova <do-not-reply@mail.tarotova.com>` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Config | Public Turnstile site key — must be available at build time |
| `TURNSTILE_SECRET_KEY` | Secret | Turnstile server-side verification |

The earlier deployment's public Turnstile key was fixed by re-adding it as
Config and rebuilding. The essential requirement is build-time availability;
the earlier claim that all Secret-type values are runtime-only was not
verified and should not be treated as a general Vercel rule.

Production email now requires `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and
`EMAIL_FROM`. Missing configuration returns a service error rather than
silently logging OTPs through the development console provider.

## Database (Supabase)

| Item | Value |
| --- | --- |
| Project region | `ap-northeast-1` (Tokyo) |
| Connection mode | Transaction pooler (`aws-0-ap-northeast-1.pooler.supabase.com:6543`) |
| Driver | `postgres.js` via `drizzle-orm/postgres-js` (real Postgres); embedded `pglite` locally/in tests when `DATABASE_URL` is unset — see `src/server/db/client.ts` |
| Migrations | Run automatically on first query per cold start (`ensureMigrated()`, idempotent) |
| Tables | `browser_sessions`, `readings`, `verified_emails`, `email_challenges`, `rate_limit_buckets`, `delivery_events`, `suppressed_emails` |

**Region fix pending deployment:** The previous investigation reported US
execution (`iad1`) against Tokyo Postgres. `vercel.json` now pins functions to
`hnd1`. Confirm actual execution in Vercel deployment/runtime details and the
new OTP logs' `region` field; response headers can also reflect edge routing.
See `docs/ISSUES.md` for measurements and verification steps.

## Email (Resend)

| Item | Value |
| --- | --- |
| Sending domain | `mail.tarotova.com` (deliberately a subdomain — see DNS section) |
| From address | `Tarotova <do-not-reply@mail.tarotova.com>` |
| Free tier | 3,000 emails/month, 100/day |
| DNS verification | DKIM/SPF/MX/DMARC — all confirmed resolving correctly via Cloudflare (see DNS section) |
| Status as of this writing | **Not confirmed working end-to-end** — see `docs/ISSUES.md` |

## Deployment flow

1. Code changes committed and pushed to `main` on GitHub.
2. Vercel's GitHub integration picks up the push, builds, and deploys to
   Production automatically — no manual "Redeploy" click needed for code
   changes (only needed after changing environment variables, since those
   aren't picked up by an already-running build).
3. `NEXT_PUBLIC_*` variables are baked in at **build time**; everything
   else is read at **runtime** inside the serverless function.

## Known issues

See `docs/ISSUES.md` for full details and status:
1. **Slow interactions:** Tokyo region configured locally and one redundant
   database round trip removed; production timing verification pending.
2. **Missing OTPs:** Silent console fallback, cooldown budget consumption,
   misleading send-success UI and broken resend path fixed locally. New
   logs identify the first failing stage. The production cause and live
   inbox delivery remain unconfirmed until deployment and a real attempt.
