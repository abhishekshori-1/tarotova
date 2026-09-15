# Versioning, backups and rollback

How Tarotova moved from v1 to v2 on 14 September 2026, what was preserved,
and exactly how to go back. Keep this current whenever a release changes the
database schema or the access model.

## Version markers

| Marker | Commit | What it is |
| --- | --- | --- |
| Tag `v1.0-pre-v2` | `d4d4ad1` | The last v1 `main`: per-reading email verification, ivory visual, no browser tests |
| Branch `backup/main-v1` | `d4d4ad1` | Same commit as the tag, as a branch so it can be pushed over `main` in one command |
| Merge commit | `ae92a67` | v2 (Release A) landing on `main` from `feat/v2`, 8 commits, 106 files |
| Branch `feat/v2` | `7e0cec1` | The v2 work as it was merged; safe to delete once v2 has settled |
| Tag `v2.0-pre-b` | `6feafb7` | The last Release A `main`, before Release B |
| Merge commit | `a7c8ba5` | Release B landing on `main` from `feat/release-b`, 27 commits, 2026-09-16; generation off (`GENERATION_ENABLED` absent) |
| Branch `feat/release-b` | `788f29d` | The Release B work as merged; `preview.tarotova.com` is assigned to it |

`git log v1.0-pre-v2..main` lists everything v2 added.

## What changed from v1 to v2

**Product**

- The first reading in a browser needs no email. Email verification is asked
  once, before the *second* distinct draw, and remembered for 30 days in
  that browser (`/verify`, `/verify/code`).
- An optional question is captured on the home page, editable while
  choosing cards, frozen at lock and shown with the result — as the person's
  own words, not interpreted (that is Release B).
- Card selection responds instantly; saves are serialized in the background
  with a truthful Saving / Saved / Not saved state. "Reveal these cards"
  locks the draw and goes straight to the result.
- Visual foundation: night stage (home, deck) and parchment surface
  (verification, result, policies); restyled deck; result hierarchy of
  question → perspective → per-card sections → reflection.

**Technical**

- Access is an explicit grant per reading (`reading_access_grants`, basis
  `guest` or `verified_session`), not `readings.state = verified`.
- The lock is a conditional `UPDATE … WHERE revision = $n AND state =
  'drafting'` plus the guest-slot claim and the grant, in one transaction.
- Session-level OTP (`session_email_challenges`) with the digest bound to a
  purpose; the per-reading OTP flow, its two pages and two routes are gone.
- Browser sessions slide on activity; verification is a fixed window.
- Drafts expire at read time; a retention job (`/api/internal/cleanup`,
  Vercel Cron daily, `CRON_SECRET`) deletes expired data.
- Turnstile fails closed in production when unconfigured.
- CI: tsc, eslint, 116 Vitest tests, production build, 9 Playwright tests at
  320 / 390 / 1440 px.

**Database (applied automatically on the first request after deploy)**

| Migration | Effect |
| --- | --- |
| `0001_wakeful_ted_forrester` | Adds `reading_access_grants`, `session_email_challenges`; adds `browser_sessions.guest_reading_id / verified_email_id / verified_until` and `readings.question`; backfills grants for any v1 verified readings |
| `0002_volatile_sugar_man` | Drops `email_challenges`; drops `readings.verified_email_id` and `readings.verified_at` |

`0001` is additive. `0002` is destructive: after it runs, **v1 code cannot
send or verify codes** (its tables are gone), which is why rollback below has
a schema step.

## What was backed up at the cutover

| Asset | Backed up? | Where |
| --- | --- | --- |
| Code | Yes | Tag `v1.0-pre-v2`, branch `backup/main-v1`, GitHub |
| Previous production deployment | Yes | Vercel keeps earlier deployments; "Instant Rollback" restores the last one |
| Database | **No dump taken.** The v1 data (test readings only; email delivery never worked in v1) was judged disposable | — |
| Environment variables | Not in git by design | Vercel → Settings → Environment Variables (`DATABASE_URL`, `OTP_HMAC_SECRET`, `OTP_HMAC_KEY_VERSION`, `SESSION_HASH_SECRET`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `CRON_SECRET`) |
| DNS, Resend domain, Turnstile widget | Unchanged by v2 | See `INFRA.md` |

## Rollback options, in order of preference

### 1. Fix forward (preferred)

Most problems are a small commit on `main`. Every push runs CI and deploys.
Use this unless the site is unusable.

### 2. Revert v2 as one commit (keeps the v2 schema)

```
git checkout main && git pull
git revert -m 1 ae92a67
git push origin main
```

This restores the v1 *code*. It is only safe **after the schema step below**,
because the v1 email flow needs `email_challenges`. Readings created under
v2 stay in the database; v1 will treat them as drafts or locked readings
awaiting its own email verification (they have no `verified_at`).

### 3. Vercel Instant Rollback (code only, seconds)

Vercel → Deployments → the last v1 deployment (commit `d4d4ad1`) → ⋯ →
Instant Rollback. Same caveat: run the schema step first or the email flow
breaks. Note that the next push to `main` deploys `main` again, so pair this
with option 2 if the rollback needs to stick.

### Schema step for options 2 and 3

Run in Supabase → SQL Editor before switching code to v1. It recreates what
`0002` removed; the v2 tables can stay (v1 ignores them).

```sql
CREATE TABLE IF NOT EXISTS "email_challenges" (
  "id" text PRIMARY KEY NOT NULL,
  "reading_id" text NOT NULL REFERENCES "readings"("id"),
  "intended_email" text NOT NULL,
  "code_hmac" text NOT NULL,
  "key_version" integer NOT NULL,
  "generation" integer NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" bigint NOT NULL,
  "consumed_at" bigint,
  "superseded_at" bigint,
  "provider_message_id" text,
  "send_status" text DEFAULT 'pending' NOT NULL,
  "created_at" bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS "email_challenges_reading_idx" ON "email_challenges" ("reading_id", "generation");
ALTER TABLE "readings" ADD COLUMN IF NOT EXISTS "verified_email_id" text REFERENCES "verified_emails"("id");
ALTER TABLE "readings" ADD COLUMN IF NOT EXISTS "verified_at" bigint;
```

v1's migration runner sees newer migrations already recorded in
`drizzle.__drizzle_migrations` and applies nothing, so this manual step is
not undone by a v1 cold start.

### 4. Restore data from a dump

Only possible when a dump exists (none at the v2 cutover). For future
releases, take one first — see the checklist below.

```
psql "$DATABASE_URL" < tarotova-pre-<release>.sql
```

### After any rollback

1. Open tarotova.com, run one reading end to end (v1: the email code must
   arrive; v2: the first reading needs none).
2. Check Vercel runtime logs for `[email_configuration]`,
   `[bot_check_configuration]` or 500s.
3. Confirm `x-vercel-id` still shows `hnd1` (region pin lives in
   `vercel.json` in both versions).
4. Note what happened here, and in `ISSUES.md`.

## Release B (contextual answer) — merged 2026-09-16, generation off

Merged as `a7c8ba5` with generation off; production verified afterwards
(new build live, a guest reading with a question locks without a bot check,
the result reports `interpretation: disabled`, library `content.v8-draft`).
Enabling is a separate step (`INFRA.md`, "Enabling generation"). Rollback of
the code is `git revert -m 1 a7c8ba5` or Instant Rollback; migration 0003 is
additive so there is no schema step. The section below was written before
the merge and describes what it changed.

### As prepared

Branch `feat/release-b`, from `main` after the Release A docs commits.
What it changes when merged:

- Migration `0003_bored_black_queen`: **additive** — one new table,
  `reading_generations`. The previous build ignores it, so rollback is
  `git revert -m 1 <merge>` or Instant Rollback with no schema step.
- Behaviour with `GENERATION_ENABLED` unset (the default): Release A's
  behaviour with the rewritten library and the new interface voice; no bot
  check on the reveal, no generation. `TURNSTILE_SECRET_KEY` is needed once
  the flag is on, since the guest reveal then fails closed without it.
- Behaviour with the flag on: see `IMPLEMENTATION.md` "Release B". Turning
  the flag off again hides the section but keeps stored answers (they are
  deleted with their readings after 30 days).

Merge order: eval gate → `npm run eval` report scored → tag `v2.0-pre-b` →
merge `--no-ff` → set/confirm the env vars in `INFRA.md` → redeploy → one
real reading with a question → enable the flag → redeploy.

## Checklist for the next release

- [ ] Tag `main` before merging: `git tag v2.0-pre-<next> main && git push origin --tags`.
- [ ] Take a database dump: `pg_dump "$DATABASE_URL" --no-owner --no-privileges > tarotova-pre-<next>.sql` (keep it outside the repo).
- [ ] Prefer additive migrations; if a migration is destructive, write its reverse SQL into this file before deploying.
- [ ] Merge with `--no-ff` so one `git revert -m 1` undoes the release.
- [ ] Watch the Vercel deploy, then verify the live flow and region.
- [ ] Update this file: markers table, what changed, backup table.
