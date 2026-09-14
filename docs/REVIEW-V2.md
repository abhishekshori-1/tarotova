# v2 design review

14 September 2026. Pre-implementation review of `PLAN-EXTENDED.md`,
`JOURNEY-DESIGN.md` and `ACCESS-FLOW.md` against the code on `main`
(`d4d4ad1`), with `PLAN.md` as historical context. Findings reference the
current implementation where the plans depend on it.

Confirmed product decisions this review assumes: question companion and
guided journeys first; visually distinctive, fast, accessible; phones,
tablets and desktop; one complete reading without email; verification
before the second distinct draw; verification remembered in that browser
for up to 30 days; follow-ups, refreshes and journey steps are not new
readings; journaling, other spreads, card library and accounts are future.

## Readiness assessment

The plans are honest about existing vs. proposed behavior, and the
technical direction is sound: the server-owned draw stays, access grants
replace "verified = has access", and generation is idempotent with leases.
Milestones 2, 3 and 3a are buildable now with two corrections (conditional
revision update, session lifetime). Milestone 4 onward is not ready:

1. There is no policy for sensitive free-text questions, and it is
   sequenced after the feature that needs it.
2. Guest-first turns the abuse surface from "email sends" into "paid model
   calls"; no numeric budget or fail-closed bot check exists.
3. The three documents disagree on several contracts.

Separately, the plans protect legacy verified readings that almost
certainly do not exist in production.

## 1. User experience walkthrough

**First reading (guest).** Home → optional question → choose → "Reveal
these cards" (lock + grant) → result → follow-ups. One fewer screen than
today; the right shape. Gaps: the reveal-once rule has no stated mechanism
(client flag vs. server `revealedAt`); "Preparing your reflection" → answer
arrival will shift layout unless the slot is fixed-height; after the third
follow-up the only CTA is "Begin another reading" → gate, which is where
the value proposition is tested and no document gives it copy.

**Second-reading gate.** The draft is created first (carrying the question),
then the gate, then auto-resume — good. The docs promise verification
"before card selection" but enforce at lock, so the losing tab of a two-tab
race sees the gate after selecting; acceptable, but the copy spec should
say so. Missing state: verified session whose cookie expired (finding 3).

**Guided journey.** chooser → preview → frame → (gate) → choose → explore →
next step → completion. "Completion" adds nothing a finished "next step"
state cannot show; merge them. Two progress models coexist (Your question →
Your cards → Reveal, and Frame → Explore → Next step); define which shows
during card selection inside a journey.

## 2. Visual and interaction design

Tokens, type scale, spacing, breakpoints, the motion table and reduced-motion
rules are concrete enough for a foundation. They are not enough for a
distinctive result: only one wireframe exists (explore stage), there are no
home/choose compositions, and the plan itself names the cards as the biggest
lever while the art is still 22 line glyphs with no sourcing decision.
Undefined: which screens are "night" and which "parchment", and what happens
at the reveal — a dark→light flip mid-ceremony is the most likely jarring
moment. The fixed bottom tray plus the iOS keyboard is the known-hard case
and is flagged correctly. The accessibility spec is good; `CardBackSlot`
already announces slot and order without identity.

## 3. Content and personalization

Three cards × (core meaning + position text + focus note) plus the question
is enough input for a hosted model to write a relevant answer. The risks are
elsewhere: the house rules (upright only, Challenge = upright difficulty, no
prediction or certainty) live in code comments, not in any prompt constraint
or automated check; there is no rubric and the 30-question set does not
exist; none of the journey scripts, fallback follow-ups, "beyond what this
spread can support" copy or distress copy exist; two external reviewers are
unsourced. Practitioner/editorial review of the card meanings and sample
interpretations is a separate editorial track with its own owner. Prompt
constraints are engineering work and belong in milestone 4.

## 4. Access and reliability — verified in code

- Revision check is read-then-write (`readingService.ts` pre-read at the
  top of `updateSelection`, unconditional `update … where id`).
- No transactions exist yet; `prepare: false` is set on postgres.js, so
  `db.transaction()` works through Supabase's transaction pooler.
- Sessions are fixed 30 days from creation and never renew (`session.ts`).
- `verifyTurnstile` returns `true` with a warning when the secret is unset.
- The OTP digest context has no purpose field (`otp.ts`).
- `draftExpiresAt` is written and indexed but never read; `IMPLEMENTATION.md`'s
  "expiry enforced at read time" is true only for access expiry.
- `ensureMigrated` runs DDL at cold start with the runtime credential.

## 5. Material findings, by severity

### 1. Sensitive questions have no policy, sequenced after the feature that needs it

`PLAN-EXTENDED.md` §5 defers distress handling until follow-ups; the initial
question in milestone 4 is already open-ended. Scenario: "Should I stop
taking my medication?" receives a tarot-framed answer. Impact: real harm and
reputational damage. Correction: in milestone 4 add a server-side
pre-generation classification (provider moderation or a cheap model call)
with authored non-tarot responses and resources for crisis, medical and
legal categories; prompt constraints for everything else; at least five
such cases in the evaluation set as a release gate.

### 2. Anonymous generation cost is unbounded and the bot check fails open

`ACCESS-FLOW.md` §7 and `PLAN-EXTENDED.md` §9 name budgets without numbers.
Today `POST /api/readings` allows 30/hour/IP, `resolveSession` mints a fresh
session for any cookieless request, and `verifyTurnstile` passes when
unconfigured — the failure class that just cost the email flow. Scenario: a
script drops cookies, creates readings, locks, receives guest grants and
triggers generation; rotating IPs make spend unbounded. Correction: fail
closed in production like `EmailConfigurationError`; require a Turnstile
token on the guest lock/generate call; concrete caps per session/day, per
IP/day and a global daily counter in `rate_limit_buckets`; a provider-side
spend limit; a server flag that disables guest generation alone.

### 3. Session lifetime breaks "remembered 30 days" and "one free reading"

`ACCESS-FLOW.md` §1/§5 bound verification to the session's expiry, which is
30 days from creation with no renewal. Scenario: verify on day 29 →
remembered for one day; on day 30 the cookie dies, a new session is created,
it receives a new free reading and loses the old readings. Correction:
sliding session expiry (renew when fewer than N days remain), a
`verified_until` on the session set 30 days from verification, and an
explicit statement that clearing cookies resets the allowance.

### 4. Legacy migration and rollback target data that does not exist

`ACCESS-FLOW.md` §7 and milestone 3a plan backfills and a dual entitlement
model. Production has never delivered an OTP (`ISSUES.md`: domain
verification was never started), so there are no verified readings.
Correction: run `select state, count(*) from readings group by state` on
production; if verified = 0, cut over cleanly — remove the reading-bound OTP
flow, no backfill, no dual policy, no legacy tests. Keep a single flag as a
guest-grant kill switch.

### 5. Retention promises have no deletion runtime

`PLAN-EXTENDED.md` §9 (24-hour draft, ≤30-day answers) and `PLAN.md` §7
(hourly job). Nothing deletes anything today; drafts are not even checked at
read time; Vercel Hobby cron runs at most daily (verify against current
docs). Persisting question text and answers under a published retention that
is not honored is a privacy-policy breach. Correction: Supabase `pg_cron`
deletes in the database with no Vercel dependency; add the read-time draft
check now; make proven deletion a gate for milestone 4.

### 6. Revision enforcement must become a conditional update before milestone 3

`readingService.ts` (`updateSelection`); the plan's §8 item 4 identifies this
correctly. Scenario: two tabs lock different slots; both pass the pre-read;
last write wins, and with guest claims the winner may differ from what the
user saw. Correction: `UPDATE readings SET … WHERE id = $1 AND revision = $2
AND state = 'drafting' RETURNING`, 409 on zero rows; lock, guest claim
(`UPDATE browser_sessions SET guest_reading_id = $r WHERE id = $s AND
guest_reading_id IS NULL`) and grant insert in one transaction. Move
migrations out of cold start and off the runtime credential before adding
four or more tables (`PLAN.md` §7 already requires this).

### 7. The three documents disagree on contracts

`JOURNEY-DESIGN.md` §5 omits the access-grant and session-challenge tables
that `ACCESS-FLOW.md` §5 requires. `PLAN-EXTENDED.md` §13A has the user
"approve any rewritten question" while `JOURNEY-DESIGN.md` §3 makes
clarification authored-only with no model call. §9 leaves the context-edit
endpoint undecided. Correction: one schema section in one document;
authored-only clarification (no model in the pre-draw path);
`PATCH /api/readings/[id]/context`, revision-checked.

### 8. Evaluation is unspecified, so milestone 4 cannot be accepted

`PLAN-EXTENDED.md` §12's "must relate to the question and reference only the
selected cards" has no measurement. Correction: a rubric (relevance,
groundedness to the supplied meanings, no reversal/prediction/certainty
language, tone, safety, length); automated checks (card-name references
match, banned phrases); the 30-question set written before the adapter; a
human-review sample. This work is not inside the "4–6 days" estimate.

### 9. Required regression scenarios have no test runtime

§12 lists two-tab, rapid-tap, keyboard-open and iOS autofill scenarios;
milestone 7 says "browser automation". No Playwright and no CI exist.
Correction: GitHub Actions running Vitest plus a minimal Playwright suite in
milestone 2, growing per milestone; a manual physical-device checklist for
what emulators cannot prove.

### 10. Distinctiveness depends on card art with no sourcing decision

`PLAN-EXTENDED.md` §3. Scenario: the "midnight observatory" ships with the
same glyph SVGs on a dark background. Correction: decide between
commissioning 22 faces, restyling the public-domain 1909 Pamela Colman
Smith deck, or accepting glyphs for this release; specify the night/parchment
screen split and the reveal transition.

## Product decisions needing clarification

1. Sensitive-question policy: refuse with resources, reframe, or both; which
   categories.
2. Session policy: sliding expiry; whether "cookie cleared = new free
   reading" is acceptable.
3. Legacy data: confirm production has no verified readings → clean cut-over.
4. Card art sourcing: commission, public-domain 1909 restyle, or keep glyphs.
5. Whether guests receive the model answer at all, and the monthly spend
   ceiling.
6. Vercel plan: Hobby's cron cadence, function duration and non-commercial
   terms — stay or move to Pro.
7. Clarification step: authored-only or model-rewritten.

## Smallest coherent first release

**Release A — guest reading, fast and honest.** Milestones 2 + 3 + 3a plus
intention capture, no model: responsive foundation and tokens; immediate
selection with a serialized save queue; conditional revision updates; lock,
claim and grant in one transaction; first reading without email;
session-continuation OTP for the second draw; optional question stored,
frozen at lock and shown with the reading, labeled as an intention rather
than interpreted; result hierarchy (takeaway → cards → reflection). Clean
cut-over rather than migration if decision 3 confirms.

Acceptance criteria:

- Two concurrent locks on one session yield exactly one guest grant; the
  loser receives 409 with its intent preserved.
- Rapid select/deselect during a slow save converges to the last intended
  selection with a truthful Saving/Saved state.
- A different browser with the URL receives 404 from every private endpoint.
- Session-continuation codes: wrong, expired, superseded and reading-bound
  codes fail; duplicate confirmation is idempotent; success resumes the
  intended draft.
- Refresh, back and reopening never trigger the gate; a fresh draw without
  valid verification does.
- Turnstile misconfiguration in production returns an error, not a pass.
- Read-time draft expiry exists; the deletion job is proven in staging.
- The existing 70 tests pass plus new integration tests for the above; CI
  runs them; the flow works at 320 px and on desktop.

**Release B** — contextual answer only, behind a server flag, for guest and
verified readings, with findings 1, 2 and 8 satisfied.
**Release C** — follow-ups and the three guided journeys.

Editorial and practitioner review of the 22 cards and three journey scripts
runs in parallel with its own owner; it is not a development milestone.

## Adopted adjustments

Agreed after discussion on 14 September 2026. These supersede the
corresponding recommendations above.

**Adopted as written:** safety and evaluation before the first personalized
answer, with the evaluation set and rubric written before the adapter;
server-enforced generation budgets including a global limit and a
fail-closed bot check; atomic selection, lock and guest grant; real expiry
enforcement and deletion via Supabase `pg_cron` (Vercel Hobby cron is daily
only); one authoritative schema/API specification; CI and browser tests
from milestone 2; journey completion merged into the final step with one
progress indicator throughout a guided journey.

**Legacy data (finding 4).** Do not assume production has zero verified
readings; failed delivery does not prove it. The count query decides.
Regardless of the result, rollback means turning the guest-grant flag off,
never reverting code: migrations stay additive so the previous build still
runs, and grants already issued remain readable.

**Sessions (finding 3).** Session expiry slides on activity. Verification
does not: `verified_until` is set once at verification + 30 days and is
never extended by ordinary use, so reverification is a real event rather
than something activity silently postpones.

**Sensitive intent (finding 1).** Classify intent, not topic keywords: a
model-based classifier against a small taxonomy (self-harm/crisis, medical
or legal instruction, abuse, ordinary-but-stressful) with near-miss pairs in
the evaluation set — "should I stop my medication" versus "how do I approach
this appointment". Quality for the ordinary cases is a rubric matter, not a
gate.

**Answer space (walkthrough, section 1).** Reserve a skeleton with a
`min-height` of roughly four lines, positioned so growth only pushes content
below it. No fixed or maximum height; long answers, enlarged text and small
screens must still fit.

**Leases do not guarantee one paid call (new).** A successful provider call
followed by a failed save causes a paid retry. Reserve budget before the
provider call, not after the save; persist an attempt row marked
`provider_called` before awaiting the response; on retry treat a
`provider_called` attempt without a stored result as uncertain; cap paid
attempts per generation at two. Use provider idempotency keys where offered;
where not, the cap is the only guarantee.

**Release A scope.** Release A is an intention-based foundation and must say
so in-product: the question "appears with your reading" and nothing more.
Bring the finished home, choose and result compositions, the card back and
three representative face studies (The Star, The Tower, The Fool) into
Release A so the visual ambition survives the engineering work. Use the
three finished faces in the public hero only; keep the result deck uniform
— all 22 glyphs restyled inside the new frame — until all 22 faces exist,
so a private reading never shows a random mix of finished and placeholder
art.
