# Infrastructure

What's deployed and how the pieces connect. Updated 2026-09-14 for v2
Release A (`VERSIONING.md` has the rollback procedure). Complements
`IMPLEMENTATION.md` (what the code does) and `PLAN.md` / `PLAN-EXTENDED.md`
(the design). Update this when any account, region, DNS record, environment
variable or scheduled job changes — it's a snapshot, not a live dashboard.

## One-paragraph picture

A visitor hits `tarotova.com`, which Cloudflare resolves (Cloudflare is the
DNS host, not a proxy) and redirects to `www.tarotova.com`, served by a
Vercel-hosted Next.js app running in Tokyo. The app talks to a Postgres
database on Supabase (Tokyo) for all state, calls Resend (from the dedicated
`mail.tarotova.com` sending subdomain) to deliver one-time codes when a
browser starts its second reading, calls Cloudflare Turnstile before
sending a code and before an email-free reveal, and — once Release B is
switched on — calls the Anthropic API to classify the typed question and
write the personalized reflection. Vercel Cron calls the app's cleanup route
once a day. GitHub is the source of truth; pushing to `main` runs CI and
auto-deploys.

```
Visitor
  │
  ▼
Cloudflare DNS (tarotova.com — "DNS only", not proxied)
  │  A/CNAME → Vercel
  ▼
Vercel (Next.js 16, Node serverless, region hnd1 Tokyo)  ◀── Vercel Cron, daily → /api/internal/cleanup
  │                          │                         │                          │
  ▼                          ▼                         ▼                          ▼
Supabase Postgres (Tokyo)   Resend (mail.tarotova.com) Cloudflare Turnstile       Gemini + Anthropic APIs (Release B, live)
  all app state              one-time codes            code request + guest reveal  intent classifier + reflection
```

## Domain

| Item | Value |
| --- | --- |
| Registrar | Namecheap |
| Domain | `tarotova.com` |
| Registered | 2026-09-13, renews 2027-09-13 (auto-renew on) |
| WHOIS privacy | On (WithheldForPrivacy) |
| Nameservers | `raquel.ns.cloudflare.com`, `santino.ns.cloudflare.com` |

Namecheap's own redirect/email-forwarding/PremiumDNS features are **not** in
use — they only apply when Namecheap's nameservers are authoritative.

## DNS (Cloudflare — Free plan)

Every record is **DNS only** (grey cloud), deliberately, so Vercel's TLS
issuance and Resend's mail routing aren't affected by Cloudflare's proxy.

| Type | Name | Value | Purpose |
| --- | --- | --- | --- |
| A | `@` | `216.198.79.1` | Vercel apex — 308 redirect to `www` |
| CNAME | `www` | `f716c9aeda181f35.vercel-dns-017.com` | Vercel canonical serving domain |
| MX | `@` | `eforward1..5.registrar-servers.com` (prio 10-20) | Namecheap email forwarding — unrelated to the app |
| TXT | `@` | `v=spf1 include:spf.efwd.registrar-servers.com ~all` (approx.) | SPF for that forwarding |
| TXT | `resend._domainkey.mail` | DKIM public key | Resend DKIM for `mail.tarotova.com` |
| MX | `send.mail` | `feedback-smtp.ap-northeast-1.amazonses.com` (prio 10) | Resend bounce/feedback (Resend runs on SES) |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | SPF for Resend, isolated on `send.mail` so it never conflicts with the root SPF |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DMARC, monitor only |

### Cloudflare Turnstile

- One widget, "Managed" mode, hostname `tarotova.com` (covers subdomains;
  the UI rejects subdomains as separate hostnames).
- Site key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Vercel type **Config** — it
  must be inlined into the browser bundle at build time; changing it needs a
  rebuild). Secret key → `TURNSTILE_SECRET_KEY` (type Secret).
- Used on the session-verification form (`/verify`) and, while
  `GENERATION_ENABLED` is on, on the card-selection page for an unverified
  session's reveal (the email-free reading). Client: `src/components/TurnstileWidget.tsx`;
  server: `src/server/turnstile.ts`, which **fails closed in production**
  if the secret is missing — with generation enabled, a missing secret also
  blocks every guest reveal (503 `bot_check_not_configured`).

## Hosting (Vercel)

| Item | Value |
| --- | --- |
| Team | Mosho (Hobby plan) |
| Project | `tarotova` |
| Source | GitHub `abhishekshori-1/tarotova`, branch `main` — every push builds and deploys to Production. Release B code live since 2026-09-16 (`a7c8ba5`), generation off |
| Branch deployments | Disabled for `feat/v2` via `vercel.json` `git.deploymentEnabled`; `feat/release-b` builds as Preview and is served at `preview.tarotova.com` (domain assigned to the branch); other branches get Preview deployments by default |
| Domains | `tarotova.vercel.app`, `tarotova.com` (redirects to www), `www.tarotova.com` (canonical) |
| Framework / runtime | Next.js 16 App Router, Node.js serverless functions |
| Function region | `hnd1` (Tokyo) via `vercel.json` `regions` — confirmed live (`x-vercel-id: bom1::hnd1::…`); warm API calls ~0.3–0.4 s from India |
| Cron | `0 3 * * *` UTC → `GET /api/internal/cleanup` (`vercel.json` `crons`); Vercel sends `Authorization: Bearer $CRON_SECRET` |
| Build | `next build` (Turbopack); `NEXT_PUBLIC_*` inlined at build time, everything else read at runtime |

### Environment variables (Production)

| Variable | Type | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Secret | Supabase connection string (transaction pooler, port 6543) |
| `OTP_HMAC_SECRET` | Secret | HMAC key for code digests |
| `OTP_HMAC_KEY_VERSION` | Config | `1` |
| `SESSION_HASH_SECRET` | Secret | Session-token and email-lookup hashing |
| `EMAIL_PROVIDER` | Config | `resend` (production refuses anything else) |
| `RESEND_API_KEY` | Secret | Resend key with sending access |
| `EMAIL_FROM` | Config | `Tarotova <do-not-reply@mail.tarotova.com>` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Config | Public Turnstile site key (build time) |
| `TURNSTILE_SECRET_KEY` | Secret | Turnstile server verification |
| `CRON_SECRET` | Secret | Authorizes the cleanup route; without it the route refuses every call and the cron does nothing |
| `GENERATION_ENABLED` | Config | Release B master flag, **on in production since 2026-09-16**. False hides the personalized section entirely, including answers already stored. A change takes effect on the next deployment, not immediately |
| `GUEST_GENERATION_ENABLED` | Config | Optional; `false` pauses generation for email-free readings only |
| `GENERATION_PROVIDER` | Config | Ordered chain; production default `gemini,anthropic` (Gemini preferred, Anthropic on any Gemini failure). A listed provider without a key is skipped and logged |
| `GENERATION_REVIEW_PROVIDER` | Config | Grounding reviewer, configured independently of the writer chain (`gemini` or `anthropic`; its own key must be set). **Required for generation**: unset or unavailable withholds every generated answer after triage, logged as `[generation_configuration]`. No review fallback. Evaluated value: `anthropic` |
| `GENERATION_CLASSIFIER_PROVIDER` | Config | Optional: triage by a vendor other than the writer chain's first (that vendor's `*_CLASSIFIER_MODEL` applies). Unset keeps the chain's first provider; a misconfigured value is logged and the chain triages |
| `ANTHROPIC_PROMPT_CACHE` | Config | Optional `5m` or `1h`: caches Anthropic system prompts. Off by default; pays only above ~2 reviews/hour (1h TTL). `cacheWriteTokens` / `cacheReadTokens` in `[generation]` usage measure it |
| `GENERATION_REVIEW_MODEL` | Config | Optional override for the review model, otherwise the selected provider's answer model. Changing reviewer requires re-running calibration and the full quality gate |
| `GEMINI_API_KEY` | Secret | Google AI Studio key (Gemini Developer API). Set a budget/quota on the Google Cloud project it belongs to |
| `GEMINI_MODEL`, `GEMINI_CLASSIFIER_MODEL` | Config | Optional overrides; default `gemini-3.8-flash` for both |
| `ANTHROPIC_API_KEY` | Secret | Anthropic API key. Prepaid credits with auto-reload off are the spend cap |
| `ANTHROPIC_WORKSPACE_ID` | Config | Only when the key is organization-level (the API rejects such keys without a workspace); a workspace-scoped key needs nothing |
| `ANTHROPIC_MODEL`, `ANTHROPIC_CLASSIFIER_MODEL` | Config | Optional overrides; defaults `claude-sonnet-5` and `claude-haiku-4-5-20251001` (`GENERATION_MODEL` / `CLASSIFIER_MODEL` still honoured) |
| `GENERATION_LIMIT_SESSION_DAY`, `GENERATION_LIMIT_IP_DAY`, `GENERATION_LIMIT_GLOBAL_DAY` | Config | Optional; defaults 10 / 30 / 400 per UTC day |
| `GENERATION_TIMEOUT_MS` | Config | Optional; default 30000 per call; a second attempt only starts within 25 s of the request so the route's 60 s `maxDuration` holds |

Editing a variable never changes a running deployment — redeploy afterwards.
Two lessons from v1 (details in `ISSUES.md`): the public Turnstile key had to
be type Config to reach the browser bundle, and a `RESEND_API_KEY` row that
existed but held an empty value had to be deleted and re-added.

## Database (Supabase)

| Item | Value |
| --- | --- |
| Project region | `ap-northeast-1` (Tokyo) |
| Connection | Transaction pooler `aws-0-ap-northeast-1.pooler.supabase.com:6543`; `postgres.js` with `max: 5`, `prepare: false` |
| Driver | `drizzle-orm/postgres-js`; pglite locally and in tests when `DATABASE_URL` is unset |
| Migrations | `drizzle/0000`–`0003`, applied automatically on the first query of each cold start (`ensureMigrated()`, idempotent) with the runtime credential — a separate migration credential is still pending |
| Tables | `browser_sessions`, `readings`, `verified_emails`, `session_email_challenges`, `reading_access_grants`, `reading_generations` (Release B), `rate_limit_buckets`, `delivery_events`, `suppressed_emails` |
| Backups | No automatic backups on the free tier; take a `pg_dump` before releases (`VERSIONING.md`) |

Retention is enforced by the daily cleanup cron (24-hour drafts, 30-day
reading access and the generated answers with them, spent codes, 7-day
delivery events, orphaned sessions).

## Email (Resend)

| Item | Value |
| --- | --- |
| Sending domain | `mail.tarotova.com` — **Verified** in the Resend dashboard since 2026-09-14 |
| From address | `Tarotova <do-not-reply@mail.tarotova.com>` |
| Free tier | 3,000 emails/month, 100/day |
| Status | Working: a real code was delivered and confirmed in production on 2026-09-14 (v1 flow, before the v2 deploy). The v2 session-verification flow uses the same provider code path but has not yet had a real production send — do one after deploying |
| Webhook | `/api/webhooks/email` exists but does not verify signatures yet; not registered in Resend |

DNS resolving is not the same as Resend verification: the domain must be
submitted for verification in Resend's dashboard (the "Verify" button) and
show **Verified** there. Check that page, not `dig`, when something is off.

## AI providers — Release B

Gemini is preferred; Anthropic takes over on any Gemini failure (HTTP error,
timeout, safety block, unparseable reply), inside the same attempt, so the
reader never notices. The row stores which model actually wrote the answer,
and `[generation]` logs a `fallback` event with the reason.

| Item | Gemini (preferred) | Anthropic (fallback) |
| --- | --- | --- |
| Key | `GEMINI_API_KEY` (Google AI Studio) | `ANTHROPIC_API_KEY` (+ `ANTHROPIC_WORKSPACE_ID` for an org-level key) |
| Endpoint | `generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`, JSON-mode output against the same schema | `api.anthropic.com/v1/messages`, forced tool use |
| Models | `gemini-3.8-flash` for both the answer and the classifier (chosen 2026-09-14: cheapest, ~8–9 s per answer, valid output on every real call so far) | `claude-sonnet-5` answer, `claude-haiku-4-5-20251001` classifier |
| Timeout | 30 s per call (`GENERATION_TIMEOUT_MS`); a 3.8 Flash answer runs 8–10 s | same |
| What is sent | The question, the focus label and the three drawn cards' curated meanings. Never email, session ids or other readings | same |
| Data handling | Gemini API paid tier: not used for training (the free tier is — use a billed project) | Anthropic API terms: no training on API data |
| Status | Verified live 2026-09-14: the key lists 41 models; `gemini-2.5-*` are retired for new keys (404), so defaults moved to Google's recommended `gemini-3.8-flash` for both roles; one real classify + answer passed validation | Live locally since 2026-09-14; three eval runs, routing passes |

The app never names either vendor; the privacy page says "third-party
service providers on our behalf".

**Critical path.** Whichever vendor reviews is on the path of every question
reading: if its balance, quota or key fails, every generated answer is
withheld (the library reading still shows). Its budget and alert are part
of enabling the feature, and the `withheld` count in `[generation]` logs is
the metric to watch after launch.

## Deployment flow

1. Work on a branch; CI (GitHub Actions) runs tsc, eslint, Vitest, the
   production build and Playwright on every push.
2. Before merging a release: tag `main`, take a database dump, write reverse
   SQL for any destructive migration (`VERSIONING.md` checklist).
3. Merge to `main` with `--no-ff`; Vercel builds and deploys Production;
   the first request applies pending migrations.
4. Verify the live site (home renders, a guest reading completes, the second
   reading is gated, `x-vercel-id` shows `hnd1`).
5. Rollback: `git revert -m 1 <merge>` or Vercel Instant Rollback — after
   the schema step in `VERSIONING.md` if a migration was destructive.

### Enabling generation (Release B)

With the flag off nothing generates, so a production deploy cannot prove
the feature works. Prove it on a Preview deployment first: a branch with
deployments enabled (`vercel.json` `git.deploymentEnabled`) and the
generation variables plus `GENERATION_ENABLED=true` set in the **Preview**
environment; run one reading with a question there and check the
`[generation]` log for `succeeded`. Then set the Production variables,
`GENERATION_ENABLED=true` last, and redeploy. Turning it off is the same
in reverse and also needs a redeploy.

## Resolved production issues

Both v1 issues in `ISSUES.md` are closed: latency (functions were in the US,
database in Tokyo — fixed by the `hnd1` pin; ~2.2 s → ~0.3 s) and missing
emails (Resend domain verification had never been started, then an empty
API-key value — fixed operationally; the code changes made both failures
visible instead of silent).
