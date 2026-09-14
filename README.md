# Tarotova

A free three-card tarot reading — Situation, Challenge, Guidance — from the
22 Major Arcana. Bring a question; your first reading needs no email.
Live at [tarotova.com](https://www.tarotova.com).

This is **v2, Release A** (guest-first reading, question capture, visual
foundation). It still ships PLAN.md's section-1 **scope contingency**: the
22-card Major Arcana, not the full 78-card deck, and the interpretive copy has
not had the practitioner review PLAN.md section 9 requires — treat readings
as a working product with draft content.

## Documents

| File | What it is |
| --- | --- |
| [`docs/PLAN.md`](./docs/PLAN.md) | The original v1 product/engineering plan (`PLAN.md section N` below refers to it) |
| [`docs/PLAN-EXTENDED.md`](./docs/PLAN-EXTENDED.md), [`docs/JOURNEY-DESIGN.md`](./docs/JOURNEY-DESIGN.md), [`docs/ACCESS-FLOW.md`](./docs/ACCESS-FLOW.md) | The v2 plan: question companion, guided journeys, guest-first access |
| [`docs/REVIEW-V2.md`](./docs/REVIEW-V2.md) | Pre-implementation review of that plan and the adjustments adopted |
| [`docs/IMPLEMENTATION.md`](./docs/IMPLEMENTATION.md) | What is actually built, what isn't, and known limitations |
| [`docs/INFRA.md`](./docs/INFRA.md) | The live deployment: domain, DNS, Vercel, Supabase, Resend, Turnstile, cron |
| [`docs/VERSIONING.md`](./docs/VERSIONING.md) | v1→v2 transition, backups, rollback procedure, release checklist |
| [`docs/ISSUES.md`](./docs/ISSUES.md) | Production issues found and how they were resolved |
| [`docs/DOMAIN-RESEARCH.md`](./docs/DOMAIN-RESEARCH.md) | Domain-name research behind `tarotova.com` |

## Running it

```
npm install
npm run dev
```

Open **http://localhost:47100**. No accounts are needed locally: the database
is an embedded Postgres (pglite) under `data/`, email codes print to the
terminal and appear on the code page, and the bot check is skipped outside
production.

| Command | What it does |
| --- | --- |
| `npm test` | 116 Vitest unit/integration tests against an in-memory Postgres |
| `npm run test:e2e` | 9 Playwright browser tests at 320, 390 and 1440 px (starts its own dev server on 47102 with a throwaway database; first run needs `npx playwright install chromium`) |
| `npm run lint`, `npx tsc --noEmit`, `npm run build` | What CI runs on every push |
| `npm run db:generate` | Generate a migration after editing `src/server/db/schema.ts` |
| `npm run cards:gen` | Regenerate the placeholder card SVGs |

### Port series

This project reserves a fixed, non-default port block instead of 3000/8000/8080:

| Port  | Service |
| ----- | ------- |
| 47100 | Next.js app (`npm run dev` / `npm run start`) |
| 47101 | `npm run db:studio` (Drizzle Studio, browses the local database) |
| 47102 | The Playwright suite's own dev server |

Keep new local services in the same `471xx` block.

## How a reading works

1. **Home** (night stage): an optional question (≤500 characters, editable
   examples), a focus, and either "Choose my cards" or "Explore a general
   reading". One request creates the reading with a private, cryptographically
   shuffled mapping of the 22 cards to 22 face-down slots.
2. **Choose**: tap three slots in order (Situation, Challenge, Guidance).
   Taps respond immediately; saves are serialized in the background with a
   truthful Saving / Saved / Not saved state. "Reveal these cards" locks the
   draw — a conditional update on the reading's revision, so two tabs can't
   both win — and issues this browser's access grant in the same transaction.
3. **Result** (parchment surface): the question, a combined perspective, the
   three cards with position-specific interpretations, and one reflection.
   Readable in this browser for 30 days.
4. **Second reading**: the first is free of email; starting another draw asks
   for a one-time email code at `/verify`. Verification is remembered for 30
   days in that browser (a fixed window; browser sessions themselves slide on
   activity). Refreshing, reopening or re-reading never triggers it.

Private pages are `noindex`; private API responses are `private, no-store`;
a different browser that knows a URL gets a 404.

## What's real

Everything in production is the real service: Supabase Postgres in Tokyo,
Resend for codes from `mail.tarotova.com`, Cloudflare Turnstile on the code
request, Vercel functions pinned to Tokyo, a daily cleanup cron. Production
refuses to start a flow with missing configuration instead of silently
degrading (no console email fallback, no skipped bot check).

Locally the same code runs on pglite, the console email provider and a
skipped bot check — configured by absence, see `.env.example`.

## What's simplified

- **22 cards, one deck page.** The 78-card, paginated deck stays future work.
- **Card art** is the generated line-glyph set restyled onto parchment with a
  gold frame (`scripts/generate-card-svgs.mjs`). Coherent, not the
  recognizable RWS scenes the plan wants; a public-domain 1909 Rider–Waite–Smith
  restyle is the chosen next step.
- **The question is shown, not interpreted.** Contextual answers (Release B)
  and follow-ups/guided journeys (Release C) are planned, not built.
- **Content is unreviewed** (`CONTENT_VERSION` ends in `-draft`).
- **The webhook** at `src/app/api/webhooks/email/route.ts` does not verify
  Resend's signature yet; don't rely on it until it does.

## Layout

`src/app/(night)` — home and card selection; `src/app/(parchment)` —
verification, result, privacy, terms; `src/app/api` — route handlers;
`src/server` — access grants, sessions, OTP, rate limits, email, cleanup;
`src/content` — the 22-card deck and copy; `src/components`; `src/lib` — zod
schemas, client API, save queue; `drizzle/` — SQL migrations; `tests/` —
integration tests (unit tests sit next to their code as `*.test.ts`);
`e2e/` — Playwright; `docs/`.
