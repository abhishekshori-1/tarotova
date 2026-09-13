# Tarotova (working build)

Implements PLAN.md's section-1 **scope contingency**: the 22-card Major
Arcana v1, not the full 78-card deck, because no illustrator or RWS
practitioner has been sourced yet (PLAN.md section 13). Treat every reading
from this build as a working demo — the interpretive copy has not had the
practitioner review PLAN.md section 9 requires as a release gate.

Planning docs live in [`docs/`](./docs): [`docs/PLAN.md`](./docs/PLAN.md) is
the full product/engineering plan this build follows (`PLAN.md section N`
below refers to it), [`docs/DOMAIN-RESEARCH.md`](./docs/DOMAIN-RESEARCH.md)
is the domain-name research it cites,
[`docs/IMPLEMENTATION.md`](./docs/IMPLEMENTATION.md) is the current
done/incomplete/limitations status of this build specifically,
[`docs/INFRA.md`](./docs/INFRA.md) documents the actual live deployment
(domain, DNS, Vercel, Supabase, Resend, Turnstile — how they're wired
together), and [`docs/ISSUES.md`](./docs/ISSUES.md) tracks open bugs found
in the deployed app.

The next product/design phase is specified in
[`docs/PLAN-EXTENDED.md`](./docs/PLAN-EXTENDED.md): a more atmospheric UI,
a question companion and guided journeys, responsive phone/tablet/desktop
layouts, motion and performance targets. Journaling, additional spreads and
other expansions remain future scope. These are planned features, not
implemented behavior.

[`docs/JOURNEY-DESIGN.md`](./docs/JOURNEY-DESIGN.md) details the proposed journey
screens, wireframe, content sources, model input/output and persistence flow.
[`docs/ACCESS-FLOW.md`](./docs/ACCESS-FLOW.md) specifies the proposed first reading
without email, verification when starting another reading, and remembered
verification in the same browser. This requires a backend access-policy change.

## Running it

```
npm install
npm run dev
```

Open **http://localhost:47100**.

Run the test suite with `npm test` (or `npm run test:watch` while iterating).

### Port series

This project reserves a fixed, non-default port block instead of 3000/8000/8080:

| Port  | Service |
| ----- | ------- |
| 47100 | Next.js app (`npm run dev` / `npm run start`) |
| 47101 | `npm run db:studio` (Drizzle Studio, browses the local database) |

Keep new local services in the same `471xx` block so they never collide with
whatever else is running on a dev machine.

## What's real vs. stood in for a missing account

Production uses Vercel, Supabase, Resend and Turnstile; see `docs/INFRA.md`
for the deployed infrastructure. Local development still works without
external accounts through the following configurable integrations:

| PLAN.md calls for | This build uses | Where |
| --- | --- | --- |
| Supabase-hosted Postgres, Drizzle + postgres.js | Real Postgres via `postgres.js` when `DATABASE_URL` is set (point it at Supabase — no code changes needed); embedded `pglite` (WASM Postgres, same schema/migrations) when it isn't, so dev/tests need no account | `src/server/db/client.ts` |
| Resend transactional email | Resend in production; `ConsoleEmailProvider` logs/echoes codes only in development and tests | `src/server/email/` |
| Cloudflare Turnstile bot check | The real client widget and server verification call both exist; both stay inert (no widget renders, server skips with a logged warning) until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` are set | `src/components/TurnstileWidget.tsx`, `src/server/turnstile.ts` |

A real `ResendEmailProvider` (plain `fetch`, no extra dependency) is already
written and wired up — set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and
`EMAIL_FROM` using a verified sender. Production rejects missing settings
instead of falling back to console. `vercel.json` pins the next deployment
to Tokyo; latency and live OTP verification remain pending in `docs/ISSUES.md`. The webhook route at `src/app/api/webhooks/email/route.ts`
is a stub: **it does not verify the provider's signature yet** — that must be
wired in (see the `TODO` in that file) before it's exposed publicly.

## What's simplified relative to the full plan

- **22 cards, one deck page.** PLAN.md's 78-card, three-page paginated deck
  collapses to a single 22-slot grid since the whole fallback deck fits on
  one screen. Re-introduce pagination if/when the deck grows back to 78.
- **Rate limiting and OTP verification use real atomic Postgres operations**
  (`INSERT ... ON CONFLICT DO UPDATE`, conditional `UPDATE ... WHERE
  consumed_at IS NULL`) rather than relying on any one process being
  single-connection — see `docs/IMPLEMENTATION.md` for the specific races
  this closes and the one residual gap (concurrent send+resend on the same
  reading isn't fully serialized, though the 60s cooldown covers normal use).
- **Unit and integration tests exist; browser/accessibility/load tests
  don't.** `npm test` runs Vitest against an in-memory pglite (Postgres)
  database and covers the domain/unit and database-integration rows of PLAN.md section
  9's matrix: deck composition and RWS numbering, OTP digest binding and
  leading-zero preservation, shuffle uniformity, wrong-owner and
  unverified-read denial, revision conflicts, locked-draw immutability,
  idempotent re-lock and idempotent re-verify, generation supersession
  (only the newest code verifies), committed failed-attempt counts,
  attempt lockout, per-email rate limiting, resend cooldown, and the
  suppression-list check. No CI, and PLAN.md section 9's Playwright/axe/load
  rows still aren't built. `npm run lint`, `npx tsc --noEmit`, and all 70 tests pass. See
  `docs/ISSUES.md` for the latest production-build verification status.
- **Card art** (`public/cards/*.svg`, generated by
  `scripts/generate-card-svgs.mjs`) is original but deliberately simple —
  shared frame, numeral, and one small line glyph per card. It satisfies the
  "coherent, shared frame" direction in PLAN.md section 2, not the
  "recognizable RWS symbolism" full-scene illustration bar that section also
  sets. Replace with commissioned art before any public release.

## Verified end-to-end (via curl; no browser tool was available this session)

Create → select and lock 3 slots → request code (console-logged) → wrong
code rejected and attempt counted → correct code verified → result returned
with the right cards in the right positions → repeat verify is idempotent →
a request with no session cookie is denied ownership → private responses
carry `Cache-Control: private, no-store` → a stale revision is rejected with
`409` → no card identity appears in the pre-verification page HTML. Also
re-verified after the Postgres migration with a real `next build && next
start` run (production mode) — same flow, plus confirmed `devCode` is
correctly absent from the API response outside dev. That was a historical
check: the 2026-09-14 fix now rejects the console provider in production, so
a production OTP smoke test requires Resend configuration. Open it in an actual browser to
check the visual/interaction layer (shuffle animation, focus states, mobile
layout, the Turnstile widget once a site key is set) before trusting this
further.

## Layout

Matches PLAN.md section 10's proposed folders where they apply to this
scope: `src/app` (routes), `src/server` (db, session, OTP, rate limiting,
email), `src/content` (the 22-card deck and copy), `src/components`,
`src/lib` (zod schemas, client API wrapper), `drizzle/` (SQL migrations),
`public/cards/`, `tests/` (integration tests + Vitest setup — pure-unit
tests are colocated as `*.test.ts` next to the code they cover), `docs/`
(the plan, its domain research, and this build's implementation status).
