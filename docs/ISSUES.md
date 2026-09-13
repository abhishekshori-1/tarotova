# Known issues

Live issue log for the deployed app (`docs/IMPLEMENTATION.md` covers the
codebase's overall done/incomplete state; this file is specifically for
open bugs found in production). Update status inline as these move;
don't let this drift into a second, contradicting source of truth.

---

## Issue 1: Every interaction is slow

**Status:** Open — root cause identified, fix not yet applied/confirmed.

**Symptom:** Every button click / interaction on the live site
(`tarotova.com`) feels sluggish to the user.

**Measured evidence:** Timed directly against the production site:

| Request | Time |
| --- | --- |
| Homepage (`/`, static, no DB) | ~0.09s |
| `POST /api/readings` (creates a DB row) | ~2.15-2.25s, consistently — not just a one-off cold start |
| `/reading/[id]/email` page (client-rendered shell) | ~0.43s |

The static, no-database homepage is fast. Anything that touches the
database is consistently ~2+ seconds slower, every time, not just on the
first ("cold") request.

**Root cause:** A region mismatch. `x-vercel-id` response headers show the
serverless function executing in a US region (`iad1`, matching Vercel's
default). The Supabase Postgres database is in `ap-northeast-1` (Tokyo).
Every database round trip pays the full US-to-Tokyo network latency, and
several endpoints make more than one sequential query per request (e.g.
`createReading` does an insert, then a follow-up select), so the delay
compounds within a single request.

One earlier data point consistent with this: a single `FUNCTION_INVOCATION_TIMEOUT`
(504) was observed on the very first request right after a deploy — plausibly
a cold container needing to both establish the cross-region connection *and*
run pending migrations before responding, together exceeding the timeout that
one time. Not reproduced since, but consistent with the same root cause.

**Fix options, in order of preference:**
1. **Change Vercel's function region to Tokyo (`hnd1`)** to co-locate with
   Supabase — Project Settings → Functions → Region. No data migration
   needed, should be a fast, low-risk change. **Not yet done as of this
   writing.**
2. Supabase itself **cannot change an existing project's region
   in-place** — the region is fixed at creation. If option 1 turns out to
   be undesirable for some other reason, the alternative is creating a
   *new* Supabase project in a region matching Vercel's function region,
   then migrating schema and data to it and updating `DATABASE_URL` —
   meaningfully more disruptive, only worth it if option 1 is ruled out.

**Next step:** Apply fix option 1, then re-measure the same
`POST /api/readings` timing to confirm the improvement.

---

## Issue 2: OTP emails aren't arriving — Resend shows no record of any send

**Status:** Open — not yet root-caused. Two real bugs were found and fixed
along the way (below), but the core symptom (no email, no Resend log
entry) has not yet been observed to resolve, and no attempt has yet fully
confirmed or ruled out the underlying cause.

**Symptom:** User completes the real flow on the live site (choose 3
cards → email screen → solves the Turnstile widget → "Send my code") using
their real address (`abhishekshori@gmail.com`). No code email arrives
(checked inbox and spam/junk — not in either). Resend's dashboard "Logs"/
"Emails" section shows **zero entries** for any of these attempts — not a
bounce, not a failure, nothing at all.

**What that specific symptom means:** if Resend had received the API call
at all, *something* would show in its logs, even a rejected/failed one.
Zero entries means the request never reached Resend's API — the failure is
somewhere before that call, not in delivery/deliverability itself (spam
filtering, DNS, etc. would all still produce a Resend log entry).

**Two real bugs found and fixed this session, both of which were
independently capable of preventing any request from reaching the server
at all:**

1. **`EMAIL_PROVIDER` variable type mismatch.** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   was initially saved in Vercel as type "Secret," which is runtime-only
   and never gets inlined into the browser bundle — so the Turnstile
   widget's own site key never reached the client at all, and the widget
   silently never rendered. Fixed by deleting and re-adding it as type
   "Config." (This one was about Turnstile specifically, not
   `EMAIL_PROVIDER` — noted here because it was the first blocker in the
   same causal chain: no widget → no token → button never enables → no
   request ever sent → nothing in Vercel logs, nothing in Resend logs.)
2. **Turnstile widget double-render / stale-token bugs**, in
   `src/components/TurnstileWidget.tsx`:
   - `next/script`'s `onReady` fires on every component mount, not once —
     calling `turnstile.render()` unconditionally there re-rendered into
     the same container without removing the previous widget, logged by
     Turnstile as `Cannot find Widget ...`. Fixed with a ref guard so
     render only happens once per mounted instance, plus explicit
     `turnstile.remove()` on unmount.
   - Turnstile tokens are single-use, and the server consumes the token
     during its bot-check step *before* rate-limiting/validation checks
     run — so any failure after that point (a 429, a validation error)
     left the client holding an already-spent token. Retrying without a
     fresh token failed Turnstile's own check (`bot_check_failed`),
     surfacing as a confusing generic "Couldn't send the code" error.
     Fixed by resetting the widget (and clearing the stored token) on any
     failed submission, via an imperative `reset()` handle.

**After both fixes**, requests do now demonstrably reach the server —
confirmed via genuine `429 rate_limited` responses (which only happen
*after* Turnstile's check passes and `requestOtp` actually runs). That's
real progress: the client-side path is confirmed working now.

**Current confound blocking further diagnosis:** repeated testing with the
same real address (`abhishekshori@gmail.com`) during the above debugging
has very likely exhausted the app's own rate limit — 3 sends per email per
rolling clock-hour (PLAN.md section 6) — before a single attempt could get
far enough to actually reach Resend's API. This is a **fixed clock-hour
window**, not a rolling 60-minutes-since-last-try window, so it may not
have cleared yet even after a 5+ minute wait. A workaround was suggested
(Gmail `+` alias, e.g. `abhishekshori+test1@gmail.com` — the app
deliberately doesn't strip `+` tags, so this gets a fresh rate-limit budget
while still delivering to the same inbox) but has not yet been confirmed
tried.

**What's genuinely still unknown:** whether a request that gets past *both*
Turnstile *and* the rate limit actually succeeds in calling Resend, and if
it doesn't, what the actual error is. That has not yet been directly
observed — every attempt so far has been blocked by one of the above before
reaching that point.

**Next steps, in order:**
1. Retry using a fresh address (the `+` alias workaround, or wait out the
   rate-limit window) to get one attempt that's not blocked by either
   Turnstile or the rate limiter.
2. Immediately after that attempt, check **both** Vercel's Logs (for the
   specific `/api/readings/[id]/otp` request — look for any thrown error,
   not just the access-log line) **and** Resend's dashboard logs, in the
   same breath, so we see the true first point of failure if it's still
   not working.
3. If Vercel's logs show the request completing with `sendStatus: "accepted"`
   but Resend's logs still show nothing, that would point to a bug in
   `src/server/email/resend-provider.ts` or a Resend API-key/permissions
   issue specifically. If Vercel's logs show an exception, that's the
   direct answer.
