# Implementation status

What actually exists in this repo, measured against `PLAN.md` (v1) and
`PLAN-EXTENDED.md` / `ACCESS-FLOW.md` (v2). Updated 2026-09-14 with v2
Release B built on `feat/release-b` (not yet merged; `VERSIONING.md` has
the transition, rollback and the release checklist).

## Scope this build targets

`PLAN.md` section 1's contingency — 22 Major Arcana, not 78 — remains in
force: no illustrator or RWS practitioner has been sourced (section 13).
`CONTENT_VERSION` is `content.v5-draft` (v2: overview and reflections in the
reader's voice; v3: core meaning frozen into snapshots; v4: all 22 cards
rewritten as themes to consider; v5: remaining assumptions revised, with
the overview and reflections brought into the same stance). A wording test
guards selected past verdict phrases; it does not replace editorial review.
The copy has not had the practitioner review section 9 sets as a release gate.
Content version is recorded again at lock, alongside the text actually used,
so drafts spanning a deployment receive the correct label. Previously locked
readings retain their frozen text and version.

Of the v2 plan, **Release A** (guest-first access, question capture, fast
selection, visual foundation, retention, CI and browser tests) is live, and
**Release B** — the contextual answer — is built behind a server flag that
is **off by default** (`GENERATION_ENABLED`). Its release gate is the
evaluation run in `eval/` (see "Release B" below). Release C (follow-ups,
guided journeys) is not started.

## Done

**Product flow.** Home (question composer, focus, two actions) → choose 3 of
22 face-down cards → turn them over → result → "Pull again" → email
verification once per browser per 30 days → further readings.

| Layer | What's implemented |
| --- | --- |
| Draw engine | Server-side crypto-random Fisher–Yates over 22 card ids per reading; the browser only sees slot indices and card backs; identity resolves at lock |
| Selection / lock | Client save queue (`src/lib/saveQueue.ts`): one request in flight, edits collapse to the latest, failures stop and expose retry. Server: conditional `UPDATE … WHERE revision = $n AND state = 'drafting' RETURNING` — two tabs at the same revision cannot both succeed; identical re-lock is a no-op; reshuffle only with an empty selection |
| Access grants | `reading_access_grants`, one per reading, basis `guest` or `verified_session`, 30-day expiry. Issued inside the lock transaction; the single guest slot is claimed with `UPDATE browser_sessions SET guest_reading_id … WHERE guest_reading_id IS NULL`. A locked reading with no grant (lost race) is claimed lazily on the next result read once the session is entitled; otherwise 403 `verification_required` |
| Session verification | `session_email_challenges`: 6-digit code, HMAC-SHA256 digest bound to purpose + session + challenge + generation + email, constant-time compare, 10-minute expiry, 5 attempts (counter committed before the error), resend supersedes, single-use consumption via conditional update, idempotent re-confirm. `verified_until` = verification + 30 days, never extended by activity |
| Sessions | 256-bit token, SHA-256 hash stored, `Secure` `HttpOnly` `SameSite=Lax` cookie, 30 days, renewed on activity at most once a day |
| Question | Optional, ≤500 chars, trimmed; set at creation or `PATCH /api/readings/[id]/context` (revision-checked); frozen at lock; returned with the result |
| Contextual answer (Release B) | `POST /api/readings/[id]/interpretation`, idempotent, authorized by the same grant as the result. One `reading_generations` row per reading is the lease: claimed with a conditional update, `provider_called` + `attempts` recorded *before* the provider is awaited, at most 2 paid attempts ever, 90 s lease. Budget reserved before the call (per session/day, per IP/day, global/day in `rate_limit_buckets`). Providers form an ordered chain (`src/server/generation/fallback.ts`): Gemini (`gemini.ts`, JSON-mode output) first, Anthropic (`anthropic.ts`, forced tool use) when Gemini fails, inside the same attempt. The intent classifier (the chain's small model) routes `crisis` / `medical` / `legal` / `abuse` to authored responses in `src/content/safety.ts`; otherwise the chain's large model writes a structured answer, validated (`src/server/generation/validate.ts`: shape, lengths, banned reversal/certainty/advice phrases, no foreign card names) before it is stored. Only readings with a question generate. Kill switches: `GENERATION_ENABLED`, `GUEST_GENERATION_ENABLED` (guest readings only). Production with no key reports "unavailable" — never a fake answer |
| Bot check on the guest lock | `PUT …/selection` with `lock: true` from an unverified session requires a Turnstile token (fails closed in production); the choose page renders the widget only for those sessions |
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
| Tests | 172 Vitest tests in 21 files (content, shuffle, OTP primitives, access grants, session verification, budgets/delivery, cleanup, routes, save queue, path safety, generation lease/budgets/routing, answer validation, Anthropic adapter with mocked fetch, bot check on lock); 4 Playwright tests × 3 viewports (golden path incl. the stub answer, gate then remembered verification, stranger denied, general reading without a section + crisis routing). `npm run eval` runs the 49-question set against the real provider (needs `ANTHROPIC_API_KEY`) |
| CI | GitHub Actions on every push: tsc, eslint, Vitest, production build, Playwright (report uploaded on failure) |

## Release B — what is built and what gates it

Built (behind `GENERATION_ENABLED=false` by default): the schema (`0003`,
additive), the lease/budget service, the Gemini and Anthropic adapters
(plain `fetch`, 30 s timeout each) behind a Gemini-first fallback chain, the intent classifier and authored safety
responses, output validation, the result-page panel with a reserved
four-line slot, per-card paragraphs and "Try this", the privacy copy (a
third-party processor is named, no AI or vendor anywhere in the app), the
reader's voice in the prompt (`interpretation.v3`, see `RELEASE-B.md`) and
the interface, the `eval/` set (49 questions across the four focuses, ambiguous,
long, injection and near-miss safety pairs) and `eval/RUBRIC.md`.

**Not yet done, and required before the flag goes on in production:**

1. Run `npm run eval` with a real key; the automated gates (100 % on crisis
   and abuse routing, ≥ 90 % medical/legal, no ordinary question refused,
   ≥ 90 % valid answers, injection ignored) must pass and a person must
   score the report per the rubric (mean ≥ 4, no Agency/Honesty below 3).
2. Set `GEMINI_API_KEY` (with a budget on its Google Cloud project) and
   `ANTHROPIC_API_KEY` (prepaid credits, auto-reload off); the production
   default chain is `gemini,anthropic`. Confirm `TURNSTILE_SECRET_KEY` is
   set (the guest lock now fails closed without it).
3. Turn on `GENERATION_ENABLED` and redeploy; watch `[generation]` logs for
   `durationMs`, `usage` and `output_rejected` reasons for the first day.

## Incomplete / not built yet

- **Release B follow-through.** The three gate steps above; suggested
  follow-up questions are not generated (Release C); the classifier and
  answer prompts are v1 and unreviewed by a practitioner.
- **Release C — follow-ups and guided journeys.** Nothing built.
- **78-card deck and recognizable card art.** Decision: restyle the
  public-domain 1909 Rider–Waite–Smith deck in a later phase; until all 22
  faces exist, readings keep the uniform glyph deck.
- **Webhook signature verification.** `src/app/api/webhooks/email/route.ts`
  still has the `TODO`; anyone can POST fake bounce events and suppress an
  address. Not linked from anywhere, but it is reachable.
- **Practitioner review** of the 22 cards' copy; **legal copy** (`/privacy`,
  `/terms`) is still a placeholder. `/privacy` now explains the question
  storage and the AI provider, but operator name, jurisdiction and contact
  are still missing.
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
  cookies or a private window yields a new session and a new free reading.
  The backstops are the Turnstile check on the guest lock and the generation
  budgets (defaults 10/session/day, 30/IP/day, 400 global/day, all env
  overridable); the provider-side spend limit is the last line.
- **Generation logs** (`[generation]`, `[interpretation]`) carry reading and
  generation ids, attempt counts, reasons, token usage and durations — never
  the question or the answer.
- **`npm audit --omit=dev` reports 0 vulnerabilities**; dev-only findings
  come via `drizzle-kit`'s bundled esbuild.
- **pglite** needs `serverExternalPackages` and a lazy connection (see
  `db/client.ts`); `PGLITE_DATA_DIR` lets the e2e suite use its own database.
- **Deployments are disabled for `feat/v2` and `feat/release-b`** in `vercel.json`
  (`git.deploymentEnabled`); other branches would get preview deployments
  and, if `DATABASE_URL` is scoped to Preview, would migrate production —
  disable per branch before pushing work in progress.
- **This file drifts.** Update it with every release; `VERSIONING.md` holds
  the release checklist.
