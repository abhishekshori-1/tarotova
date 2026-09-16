# Implementation status

What actually exists in this repo, measured against `PLAN.md` (v1) and
`PLAN-EXTENDED.md` / `ACCESS-FLOW.md` (v2). Updated 2026-09-14 with v2
Release B merged to `main` on 2026-09-16 (`a7c8ba5`) with generation off;
`VERSIONING.md` has the markers, rollback and the release checklist.
Working-tree Release C status and verification were updated on 2026-09-17;
[RELEASE-C-READINESS.md](RELEASE-C-READINESS.md) records the latest conversation
gate, editorial findings and the checks still needed before deployment.

## Scope this build targets

`PLAN.md` section 1's contingency — 22 Major Arcana, not 78 — remains in
force: no illustrator or RWS practitioner has been sourced (section 13).
`CONTENT_VERSION` is `content.v8-draft` (v2: overview and reflections in the
reader's voice; v3: core meaning frozen into snapshots; v4: all 22 cards
rewritten as themes to consider; v5: remaining assumptions revised, with
the overview and reflections brought into the same stance; v6: texture pass,
declarative sentences, at most one question per text, permission language
cut, the overview a paragraph again; v7/v8: remaining presumed facts and
attributed promises removed). A wording test
guards selected past verdict phrases; it does not replace editorial review.
The copy has not had the practitioner review section 9 sets as a release gate.
Content version is recorded again at lock, alongside the text actually used,
so drafts spanning a deployment receive the correct label. Previously locked
readings retain their frozen text and version.

Of the v2 plan, **Release A** (guest-first access, question capture, fast
selection, visual foundation, retention, CI and browser tests) is live, and
**Release B** — the contextual answer — is built behind a server flag that
is **on in production since 2026-09-16** (`GENERATION_ENABLED=true`; off by default in code). Its documented release gate was
evaluation run in `eval/` (see "Release B" below). Release C follow-ups and
guided journeys are implemented on `feat/release-c`, not merged or enabled by
this readiness pass. The automated conversation gate passes; editorial/template
approval and hosted verification remain open.

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
| Contextual answer (Release B) | Authorized, idempotent generation under the reading grant, with leases and transactional spend budgets. The shared request deadline covers classification, writer fallback, independent review and at most one repair with fresh review. Current cost profile: DeepSeek writes/repairs; Gemini triages/reviews and is the writer fallback. No implicit Anthropic calls. Classification routes sensitive questions to authored support before showing card advice. See RELEASE-C-READINESS.md for evaluated settings and remaining gates |
| Bot check on the guest lock | While `GENERATION_ENABLED` is on, `PUT …/selection` with `lock: true` from an unverified session requires a Turnstile token (fails closed in production); the status carries `botCheckOnReveal` and the choose page renders the widget only then. With generation off the reveal is Release A's |
| Rate limiting | Atomic fixed-window counters: reading creation 30/h per IP and 20/h per session; codes 3/h and 5/day per email, 10/h per IP; 60 s resend cooldown checked before any budget is spent |
| Suppression | `suppressed_emails` checked before every send; populated by the (unsigned) webhook |
| Expiry & retention | Drafts and unclaimed locks are gone at read time after 24 h; `deleteExpired()` removes expired drafts, ended-access readings and grants, spent challenges, rate buckets, 7-day-old delivery events and orphaned sessions. Exposed at `/api/internal/cleanup` behind `CRON_SECRET`; Vercel Cron daily (`vercel.json`) |
| Data model | `browser_sessions`, `readings`, `verified_emails`, `session_email_challenges`, `reading_access_grants`, `rate_limit_buckets`, `delivery_events`, `suppressed_emails`, generation/follow-up rows, `journey_runs`, `journey_transitions`; Drizzle migrations 0000–0006; `postgres.js` with `DATABASE_URL`, pglite without |
| Email | Console provider outside production only; Resend via `fetch` with a 10 s timeout, idempotency key per challenge, message-id validation. Production requires `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` or returns 503 `email_not_configured`; a definite provider rejection is 502 `email_send_failed`, an uncertain one keeps the code usable |
| Bot protection | Turnstile widget on the code form (single-use token, reset after any failure, render-once guard); server verification with a 10 s timeout; **fails closed in production** when the secret is missing (503 `bot_check_not_configured`) |
| Observability | `[session_verification]`, `[session_confirm]`, `[otp_delivery]`, `[cleanup]`, `[bot_check_configuration]`, `[email_configuration]` structured logs with request id, stage, status, duration, region; `X-Request-Id` on responses; never addresses, codes or keys |
| Privacy hygiene | Private APIs send `Cache-Control: private, no-store`; readings, verification and journey pages carry `noindex`. Robots excludes `/reading/`, `/journey/`, `/journeys`, `/verify` and `/api/`. Both template routes return 404 with journeys off; owned runs remain available. Verification redirects remain same-origin |
| Content | 22 cards with core meaning, 3 position texts, 4 focus notes; deterministic overview and reflection; deck/spread/content versions frozen in the result snapshot |
| Card art | 22 generated SVG faces (parchment, ink linework, gold frame) + a night card back; `scripts/generate-card-svgs.mjs` |
| Visual | Two surfaces via route groups — night stage (home, deck) and parchment (verify, result, policies); tokens, fluid type scale, shared controls, CSS-only star map, safe-area padding on the sticky tray, reduced-motion respected, 44 px targets, visible focus |
| Tests | 347 unit/integration tests in 38 files; 88 browser checks across four viewports plus four separate flag-off checks. Includes transactions, ownership, provider deadlines, fallback cost accounting, journey expiry and support persistence. Types, lint and production build pass. Real-provider gates and editorial findings are recorded in RELEASE-C-READINESS.md |
| CI | GitHub Actions on every push: tsc, eslint, Vitest, production build, Playwright (report uploaded on failure) |

## Release B — what is built and what gates it

Built (behind `GENERATION_ENABLED=false` by default): the schema (`0003`,
additive), the lease/budget service, Gemini, DeepSeek and opt-in Anthropic adapters
(plain `fetch`, per-call limits capped by the shared deadline), configurable provider roles and authored safety
responses, output validation, the result-page panel with a reserved
four-line slot, per-card paragraphs and "Try this", the privacy copy (a
third-party processor is named, no AI or vendor anywhere in the app), the
reader's voice in the prompt (`interpretation.v3`, see `RELEASE-B.md`) and
the interface, the `eval/` set (49 questions across the four focuses, ambiguous,
long, injection and near-miss safety pairs) and `eval/RUBRIC.md`.

**Gate status at enabling (2026-09-16):**

1. Automated gates: passed on every run since v3; the last full run with
   the launch configuration is `eval/report/2026-09-15T12-26-42-137Z.md`
   (42/43 approved, 12/12 sensitive routing, 8/8 reviewer calibration).
2. Human scoring per the rubric: **not done**. Enabled by product-owner
   decision with that pass outstanding; `RELEASE-B.md` records it.
3. Production variables set (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`,
   `ANTHROPIC_WORKSPACE_ID`, `GENERATION_REVIEW_PROVIDER=anthropic`,
   `GENERATION_ENABLED=true`), verified first on `preview.tarotova.com`.
   The `[generation]` logs (`withheld`, `repaired`, `durationMs`, `usage`)
   are the live substitute for the scoring pass until it happens.

## Release C1 — follow-ups (built on `feat/release-c`, not merged, flag off)

`docs/RELEASE-C.md` is the plan. Built: `reading_followups` (migration
0004, additive); `GET/POST /api/readings/[id]/followups`; three turns per
reading, a slot spent on acceptance (a support response or a failed turn
included), reserved under a row lock on the reading, idempotent on the
client's submission id, one turn in flight, two pipelines per turn ever,
budgets shared with readings and reserved before the slot; fresh triage on
every turn with the person's earlier messages as context (Release B's
classifier text unchanged, a context paragraph added for follow-ups); the
review pipeline generalised over the answer shape so follow-ups get the
same write, review, one repair and fresh review; a 1–3 paragraph answer
schema with the shared text gates; a support response closes the
conversation while earlier turns stay readable; the panel under the
reading with authored suggestions per focus; cleanup deletes turns with
their reading; the privacy page covers follow-up messages; the browser
suite pins every generation role to the stub. `npm run eval:conversations` (gate set), `npm run eval:conversations:unseen` (regression variants kept apart so the gate set stays comparable), `npm run eval:conversations:fresh` (reserved for a final check) and `npm run eval:followup-review` (reviewer calibration on matched pairs) and `npm run eval:repair-diagnostic` (fixed candidates: reviewer consistency and repairer comparison)
runs 13 fixed sequences (escalation to crisis, a pronoun after a
medication message, a control disclosure, legal drift, a correction,
changed facts, understanding-only, access limits, a prediction demand, a
late injection, Spanish, "it", a general reading's first question) through
the production chain. Paid runs exist; the latest gate is 19/21 (90.5%), with
4/4 sensitive turns routed correctly. See the readiness record for the exact
versions, failure causes and cost limits. The human pass and hosted preview
verification remain open.

## Release C2 — guided journeys (working tree, not merged)

Three draft templates use one fixed reading, a transition ledger and ownership
and expiry inherited from that reading (migration 0006). Stage changes make no
model calls. Public template routes return 404 with the flag off; private runs
remain readable by their owners. Server-rendered home discovery avoids a browser
request and skips database work when there is no session cookie. Template review
and the hosted end-to-end check remain outstanding.

## Incomplete / not built yet

- **Release B follow-through.** The outstanding human/practitioner checks in
  its release record are not replaced by subsequent automated evaluations.
- **Release C approval.** The latest conversation gate passes, but the transcript
  has unresolved editorial findings. Template approval and hosted preview
  verification are also outstanding.
- **78-card deck and recognizable card art.** Decision: restyle the
  public-domain 1909 Rider–Waite–Smith deck in a later phase; until all 22
  faces exist, readings keep the uniform glyph deck.
- **Webhook signature verification.** `src/app/api/webhooks/email/route.ts`
  still has the `TODO`; anyone can POST fake bounce events and suppress an
  address. Not linked from anywhere, but it is reachable.
- **Practitioner review** of the 22 cards' copy; **legal copy** (`/privacy`,
  `/terms`) needs owner review. Privacy explains questions, follow-ups and
  journeys, with support@tarotova.com as the contact. Operator name and
  jurisdiction have not been supplied.
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
- **Deployments are disabled for `feat/v2`** in `vercel.json`; `feat/release-b` was re-enabled on 2026-09-16 so `preview.tarotova.com` builds from it
  (`git.deploymentEnabled`); other branches would get preview deployments
  and, if `DATABASE_URL` is scoped to Preview, would migrate production —
  disable per branch before pushing work in progress.
- **This file drifts.** Update it with every release; `VERSIONING.md` holds
  the release checklist.

## Journey discovery and provider accounting

The home entry renders on the server and never fetches a discovery API on mount.
With no session cookie it performs no migration/session/database lookup. Existing
owners get one joined resume query after session resolution, even with new starts
switched off. Local Server Components and API routes share the embedded PGlite
client; independent instances on the same directory must not be used.

Provider failure records carry model, duration, reason and reported usage through
fallback into the evaluation audit. Billed invalid JSON is counted once alongside
the successful fallback. Missing usage remains unpriced. There are separate
optional Gemini effort settings for the writer, dedicated classifier and reviewer;
unset settings preserve model defaults. See RELEASE-C-READINESS.md before changing
production configuration.
