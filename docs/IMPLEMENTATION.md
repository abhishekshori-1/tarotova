# Implementation status

What actually exists in this repo, measured against `PLAN.md` (v1) and
`PLAN-EXTENDED.md` / `ACCESS-FLOW.md` (v2). Updated 2026-09-14 after v2
Release A went live (`VERSIONING.md` has the transition and rollback).

## Scope this build targets

`PLAN.md` section 1's contingency — 22 Major Arcana, not 78 — remains in
force: no illustrator or RWS practitioner has been sourced (section 13).
`CONTENT_VERSION` is `content.v1-draft` because the copy has not had the
practitioner review section 9 sets as a release gate.

Of the v2 plan, **Release A** is built: guest-first access, question capture
(shown, not interpreted), fast selection, the visual foundation, retention,
CI and browser tests. Releases B (contextual answer) and C (follow-ups,
guided journeys) are not started. See "Incomplete" below.

## Done

**Product flow.** Home (question composer, focus, two actions) → choose 3 of
22 face-down cards → reveal → result → "Begin another reading" → email
verification once per browser per 30 days → further readings.

| Layer | What's implemented |
| --- | --- |
| Draw engine | Server-side crypto-random Fisher–Yates over 22 card ids per reading; the browser only sees slot indices and card backs; identity resolves at lock |
| Selection / lock | Client save queue (`src/lib/saveQueue.ts`): one request in flight, edits collapse to the latest, failures stop and expose retry. Server: conditional `UPDATE … WHERE revision = $n AND state = 'drafting' RETURNING` — two tabs at the same revision cannot both succeed; identical re-lock is a no-op; reshuffle only with an empty selection |
| Access grants | `reading_access_grants`, one per reading, basis `guest` or `verified_session`, 30-day expiry. Issued inside the lock transaction; the single guest slot is claimed with `UPDATE browser_sessions SET guest_reading_id … WHERE guest_reading_id IS NULL`. A locked reading with no grant (lost race) is claimed lazily on the next result read once the session is entitled; otherwise 403 `verification_required` |
| Session verification | `session_email_challenges`: 6-digit code, HMAC-SHA256 digest bound to purpose + session + challenge + generation + email, constant-time compare, 10-minute expiry, 5 attempts (counter committed before the error), resend supersedes, single-use consumption via conditional update, idempotent re-confirm. `verified_until` = verification + 30 days, never extended by activity |
| Sessions | 256-bit token, SHA-256 hash stored, `Secure` `HttpOnly` `SameSite=Lax` cookie, 30 days, renewed on activity at most once a day |
| Question | Optional, ≤500 chars, trimmed; set at creation or `PATCH /api/readings/[id]/context` (revision-checked); frozen at lock; returned with the result |
| Rate limiting | Atomic fixed-window counters: reading creation 30/h per IP and 20/h per session; codes 3/h and 5/day per email, 10/h per IP; 60 s resend cooldown checked before any budget is spent |
| Suppression | `suppressed_emails` checked before every send; populated by the (unsigned) webhook |
| Expiry & retention | Drafts and unclaimed locks are gone at read time after 24 h; `deleteExpired()` removes expired drafts, ended-access readings and grants, spent challenges, rate buckets, 7-day-old delivery events and orphaned sessions. Exposed at `/api/internal/cleanup` behind `CRON_SECRET`; Vercel Cron daily (`vercel.json`) |
| Data model | `browser_sessions`, `readings`, `verified_emails`, `session_email_challenges`, `reading_access_grants`, `rate_limit_buckets`, `delivery_events`, `suppressed_emails`; Drizzle migrations 0000–0002; `postgres.js` with `DATABASE_URL`, pglite without |
| Email | Console provider outside production only; Resend via `fetch` with a 10 s timeout, idempotency key per challenge, message-id validation. Production requires `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` or returns 503 `email_not_configured`; a definite provider rejection is 502 `email_send_failed`, an uncertain one keeps the code usable |
| Bot protection | Turnstile widget on the code form (single-use token, reset after any failure, render-once guard); server verification with a 10 s timeout; **fails closed in production** when the secret is missing (503 `bot_check_not_configured`) |
| Observability | `[session_verification]`, `[session_confirm]`, `[otp_delivery]`, `[cleanup]`, `[bot_check_configuration]`, `[email_configuration]` structured logs with request id, stage, status, duration, region; `X-Request-Id` on responses; never addresses, codes or keys |
| Privacy hygiene | Private responses `Cache-Control: private, no-store`; `/reading/*` and `/verify*` `noindex`; `robots.txt` disallows them and `/api/`; `next` redirect after verification limited to same-origin paths |
| Content | 22 cards with core meaning, 3 position texts, 4 focus notes; deterministic overview and reflection; deck/spread/content versions frozen in the result snapshot |
| Card art | 22 generated SVG faces (parchment, ink linework, gold frame) + a night card back; `scripts/generate-card-svgs.mjs` |
| Visual | Two surfaces via route groups — night stage (home, deck) and parchment (verify, result, policies); tokens, fluid type scale, shared controls, CSS-only star map, safe-area padding on the sticky tray, reduced-motion respected, 44 px targets, visible focus |
| Tests | 116 Vitest tests in 15 files (content, shuffle, OTP primitives, access grants, session verification, budgets/delivery, cleanup, routes, save queue, path safety); 9 Playwright tests × 3 viewports (golden path, gate then remembered verification, rapid taps, stranger denied, no horizontal overflow) |
| CI | GitHub Actions on every push: tsc, eslint, Vitest, production build, Playwright (report uploaded on failure) |

## Incomplete / not built yet

- **Release B — contextual answer.** No model adapter, no prompt, no
  evaluation set or rubric, no sensitive-intent classifier, no generation
  budgets or global spend cap, no Turnstile on the guest lock. The question is
  displayed only. `REVIEW-V2.md` findings 1, 2 and 8 are the entry criteria.
- **Release C — follow-ups and guided journeys.** Nothing built.
- **78-card deck and recognizable card art.** Decision: restyle the
  public-domain 1909 Rider–Waite–Smith deck in a later phase; until all 22
  faces exist, readings keep the uniform glyph deck.
- **Webhook signature verification.** `src/app/api/webhooks/email/route.ts`
  still has the `TODO`; anyone can POST fake bounce events and suppress an
  address. Not linked from anywhere, but it is reachable.
- **Practitioner review** of the 22 cards' copy; **legal copy** (`/privacy`,
  `/terms`) is still a placeholder and must mention that typed questions are
  stored for up to 30 days.
- **Migrations run at cold start with the runtime credential.** `PLAN.md`
  section 7 asks for a separate credential and a deploy-time step; still
  pending. Migrations are additive except `0002` (see `VERSIONING.md`).
- **CSRF** relies on same-origin fetch and `SameSite=Lax`; no token.
- **No analytics** or funnel measurement (`PLAN-EXTENDED.md` section 12).
- **Accessibility and device coverage** is automated only at the "no
  overflow, keyboard-operable buttons" level; VoiceOver/TalkBack, real-device
  keyboard behavior and Samsung Internet are unchecked.

## Email — current state and limits

- **Live and verified** on 2026-09-14: the `mail.tarotova.com` domain is
  verified in Resend and a real code was delivered and confirmed in
  production (under the v1 flow; the v2 session flow shares the provider
  path but still needs one real production send). The earlier failures were
  operational (domain verification never started; an empty API key value)
  — see `ISSUES.md`.
- **No deliverability history yet**; sending volume is tiny.
- **Suppression** has only been exercised with synthetic webhook payloads.
- **Limits** (3/h, 5/day per address; 10/h per IP; 60 s cooldown) are the
  plan's defaults, unvalidated against real traffic.
- **Dev-mode code echo** (`devCode` in the response, shown on the code page)
  exists only when `NODE_ENV !== "production"`; production tests assert it
  is absent.

## Other things worth knowing

- **Transactions.** The lock (draft freeze + guest claim + grant) and the
  lazy grant on result read are real transactions (`db.transaction`), which
  work through Supabase's transaction pooler because `postgres.js` runs with
  `prepare: false`. Single-statement atomic operations cover the rest
  (rate counters, attempt increments, code consumption).
- **Guest allowance is per browser session, not per person.** Clearing
  cookies or a private window yields a new session and a new free reading;
  IP limits are the only backstop. Accepted for Release A; generation
  budgets are a Release B gate.
- **`npm audit --omit=dev` reports 0 vulnerabilities**; dev-only findings
  come via `drizzle-kit`'s bundled esbuild.
- **pglite** needs `serverExternalPackages` and a lazy connection (see
  `db/client.ts`); `PGLITE_DATA_DIR` lets the e2e suite use its own database.
- **Deployments are disabled for `feat/v2`** in `vercel.json`
  (`git.deploymentEnabled`); other branches would get preview deployments
  and, if `DATABASE_URL` is scoped to Preview, would migrate production —
  disable per branch before pushing work in progress.
- **This file drifts.** Update it with every release; `VERSIONING.md` holds
  the release checklist.
