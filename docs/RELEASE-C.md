# Release C — follow-ups and guided journeys

Current publication threshold: **85%**, authorized by the owner on 17 September and shared in `eval/thresholds.ts`. Historical 90% results below keep their original threshold. Safety routing and grounding requirements are unchanged.

The owner subsequently accepted **80% for the fresh conversation set only**.
Its existing 4/5 result now meets the agreed availability criterion; the main
gate remains 85%. This does not approve the withheld reply or deployment.

The owner has approved the newly generated reading-experience answers. Current
candidate versions, reported exceptions and remaining deployment checks are in
[the 85% checkpoint](READING-EXPERIENCE-85-CHECKPOINT.md); earlier approvals in
this document retain their historical scope.

Latest combined C1/C2 implementation: [companion and journeys review](RELEASE-C-COMPANION-JOURNEYS.md).
Latest verification and release blockers: [readiness and cost pass](RELEASE-C-READINESS.md).
Earlier evaluation results below describe their named prompt versions; they do not approve the new draft templates or prompts.

Implementation plan, 16 September 2026. Proposed defaults for the implementer;
this document does not enable a flag, approve content or authorize deployment.
The product owner will implement the code.

The goal is to help someone explore a question through one fixed spread and
finish with a clearer perspective or a next step they choose. Completion must
also work for someone who wants understanding, without an action assignment.

This plan makes the Release C scope in [REVIEW-V2.md](REVIEW-V2.md) concrete.
Use [PLAN-EXTENDED.md](PLAN-EXTENDED.md) for the broader design direction and
[JOURNEY-DESIGN.md](JOURNEY-DESIGN.md) for the journey wireframe. The latter is
a September 14 proposal: its statements that question storage, access grants
and generation do not exist are historical. Release B now supplies those.
For C implementation, the current code and the contracts below take precedence
over those earlier implementation sketches. Product decisions remain the owner's.

## 1. Scope and build order

| Slice | Deliverable | Exit condition |
| --- | --- | --- |
| C1: follow-ups | Suggested or typed questions about an owned, fixed reading; three-turn allowance; safe generation and recovery | Conversation eval, concurrent-request tests and responsive flow pass |
| C2: journeys | Three authored templates, chooser/preview, three-stage runs, completion and resume | All three complete with and without generation; template review recorded |

Keep C1 and C2 independently switchable and reviewable. Do not mix a writer
vendor experiment, deck expansion or a full visual redesign into these changes.
Use the configured Release B models initially; independent classifier selection
is useful future work, but is not required to implement C with the current chain.

No accounts, cross-reading memory, journal, stored private reflection notes,
new spreads, daily streaks, notifications or extra draw per journey step.
Reuse the first-reading/second-draw verification policy. An active grant covers
follow-ups and journey steps without another email challenge.

## 2. Follow-up experience

- Place **Explore this reading** after the answer, with a compact reference to
  the original question and cards. Keep the page a reading with a conversation
  underneath, rather than replacing it with a full-screen chat interface.
- Offer two or three authored suggestions selected from the journey/focus,
  plus a text field. Label them as suggestions; no paid suggestion-generation
  call. Example: “How do these cards connect?” Selecting a suggestion fills
  the input; Send is the explicit submission action.
- Show **3 follow-ups available** before the first submission. A turn uses a
  slot when accepted for processing, including a support response or eventual
  generation failure. Explain beside the allowance: “Retries use the same
  follow-up.” Never promise three successful generated answers.
- Keep one turn in flight. Show the submitted text immediately and a stable
  pending area. Keep failed text and earlier accepted answers visible; retry
  uses the same submission ID and immutable text. A new ID is a new turn.
- Each answer responds directly in one to three short paragraphs. Do not
  repeat three full card summaries or force every card into every response.
  A final reflection is optional and a question by default. Understanding-only
  requests receive no routine, deadline or push to act.
- After the third turn, show a calm end state and retain the reading. No
  automatic redraw or pressure to continue. A journey can continue to its
  closing stage regardless of unused turns.
- Enable this on an authorized general reading too: its first typed follow-up
  supplies the personal context. On a question reading whose initial answer
  is pending/failed, show its existing recovery controls first; do not start a
  competing follow-up pipeline. An initial support/refusal response never
  exposes a tarot follow-up composer.

## 3. Context, safety and answer contract

Every submitted message gets fresh safety routing before any new generated
response. Supply the latest message, original question and bounded prior user
messages so “should I stop taking it?” can be understood in context. A turn-one
ordinary label cannot authorize turn two. Extend the classifier interface with
an explicit conversation input; do not flatten assistant text into the user's
statement or concatenate untrusted text into system instructions.

The writer and reviewer both receive distinct, structured inputs:

1. Frozen card names, positions and library snapshot from this reading.
2. Original question and user-authored messages, preserving speaker and order.
3. The original accepted answer and prior accepted assistant turns, explicitly
   marked as generated statements that may be wrong, never evidence of facts.
4. Latest message and its classification; optional frozen journey prompt.

Only this reading is context. No email, session token, other reading, hidden
profile or invented history enters the model. User corrections supersede
earlier interpretations. For example, after “I never said I was afraid,” the
answer acknowledges the unsupported assumption and stops building on it. Do
not rewrite the stored earlier answer to hide the correction.

Recommended new response shape: `paragraphs` (1–3 strings), `reflection`
(nullable string), `beyondSpread` (nullable string). Set server-side field,
total-output and token limits; start with 1,800 characters total. User text is
nonempty and at most 500 characters, matching the original question limit.
With at most three turns, preserve the bounded transcript without a generated
summary that could introduce new facts. Never silently truncate the latest
message or safety-relevant context to fit a prompt.

Reuse write → review → at most one repair → fresh full-answer review, sharing
the route's existing deadline. Add a follow-up-specific schema and reviewer
field mapping; do not force this shape through the initial answer's required
Situation/Challenge/Guidance fields or change Release B's stored output schema.
Only approved output is published. A failed review leaves an unavailable turn,
not a library paragraph pretending to answer the new question.

Sensitive routing follows the existing taxonomy and authored responses. If a
turn routes to crisis, abuse, medical or legal advice, store the support
response and end generated continuation for that reading in this first C
version. The support message is the primary current view; suppress suggested
tarot follow-ups and journey action prompts. Earlier content stays stored but
must not be presented as advice for the newly disclosed situation. Do not
overwrite the initial generation row to implement this state. A safe close/exit
remains available, and refresh or a flag change must preserve the support view.
This conservative conversation boundary needs evaluation and explicit UX copy,
particularly where the existing medical/legal copy invites emotional reflection.

## 4. Persistence and API contracts

Add `reading_followups`, separate from `reading_generations`. Each row needs:
ID, reading ID, client submission ID, server sequence, immutable input,
status, category, validated output or authored-response version, attempts,
lease token/expiry, prompt/reviewer/content versions, phase model/usage
metadata, timestamps and a safe error code. Never log the transcript or review
drafts in production.

| Endpoint | Contract |
| --- | --- |
| `GET /api/readings/[id]/followups` | Owned, unexpired access; ordered safe turns, remaining allowance, continuation state; no paid work |
| `POST /api/readings/[id]/followups` | `{ submissionId, text }`; reserve or retrieve the turn atomically; await bounded generation |
| Repeat POST | Same ID/text returns stored or active state; a retryable terminal failure may claim its one remaining attempt |
| Same ID, different text | Conflict; never replace the previous question |

Enforce uniqueness on `(reading_id, submission_id)` and `(reading_id, sequence)`.
Lock/serialize the reading while allocating a slot, checking active work and
reserving budgets; a count-then-insert without a lock is insufficient. Reserve
at most three slots across standalone and journey entry points. Invalid,
unauthorized, expired, disabled or budget-denied requests reserve no slot.
An existing in-flight turn blocks a different new submission until it settles.

Keep two lifetime provider-pipeline attempts per turn, with no automatic
pipeline restart following a review rejection. Count an uncertain timeout as
spent. Each retry uses its remaining attempt and new request deadline, never a
fresh allowance. Reserve shared provider-spend budgets before each attempt;
the original reading plus its follow-ups must not escape session/IP/global
caps. Read requests, step advancement and refresh spend nothing.

Persist results with a conditional write matching the active lease token and
attempt. A late worker cannot overwrite a result after another request reclaims
the turn. Recheck access expiry before publishing. Polling and reconnects
retrieve state; do not rely on detached serverless work after a response.

## 5. The three journeys

Author versioned templates in `src/content/journeys/`. Each includes title,
purpose, focus, question starter, optional clarification, stage copy, suggested
follow-ups, closing reflection, completion text and actual review metadata.
Templates remain draft until reviewed; do not manufacture approvals.

| Journey | Editable starter | Optional clarification | Closing reflection |
| --- | --- | --- | --- |
| Navigating a change | “What would I like to understand about this change?” | “Which part would you like to explore?” | “What feels clearer, and what still needs time or information?” |
| Preparing for a conversation | “What would I like to understand before this conversation?” | “What would you like to express or understand?” | “What would you like to say or ask, if you choose to have the conversation?” |
| Reopening creativity | “What would I like to understand about my creative work?” | “Are you seeking understanding, an experiment, or something else?” | “What do you notice now, without needing to turn it into a task?” |

These are draft editorial starters, not reviewed final scripts. Avoid assuming
the person has free time, resources, a safe counterpart or a goal of resuming
work. Clarification is optional authored text, with no model call; the person
edits and approves their question. Do not automatically append an inferred
interpretation to it.

Public routes: `/journeys` and `/journeys/[slug]`. Private owned run:
`/journey/[id]`. Stages: Frame → Explore → Reflect. The last stage can include
a chosen action but does not require one; this refines the older “Next step”
label. Finish requires no written response, additional draw or model request.

`journey_runs` stores owner session, reading ID, frozen template snapshot and
version, stage, revision, completion state, expiry and creation submission ID.
Create run and draft reading atomically via idempotent `POST /api/journeys`.
One run per reading for C; template changes cannot rearrange an active run.

`GET /api/journeys/[id]` returns owned safe state. `PATCH` takes expected
revision, submission ID and destination stage; replaying an acknowledged
transition is idempotent, while a stale competing transition conflicts. The
server derives eligibility from the reading: Explore requires a locked,
authorized draw; Reflect requires safely displayable reading content, not a
successful generated answer. Back never unlocks or replaces frozen cards or
question. A support response uses the safe exit described above.

Question, selected journey and destination survive the existing continuation
gate. Resume works in the owning browser only while access lasts; an expired
run explains expiry and offers a fresh journey without silently redrawing.
Store no optional reflection note. Completion uses already accepted reading
content or authored template copy. Every template supports generation outages.

Delete turns and runs before their parent reading, or use deliberate tested
foreign-key cascades. Their lifetime cannot extend access. Extend the existing
cleanup job and test actual deletion, including expired drafts and sessions.

## 6. UI and accessibility acceptance

Use the existing palette/type system, with a distinct illustration or visual
motif for each journey and a clear three-stage indicator. Render a phone-first
single column; use a restrained spread sidebar on wider screens. Avoid a third
repeated display of the same cards beside the conversation.

Verify 320 px width, typical iOS/Android sizes, tablet portrait/landscape,
desktop, 200% zoom, keyboard-open input and device safe areas. Controls have
clear focus and adequate touch targets. Pending updates use a polite live
region; do not announce every poll or steal focus when text arrives. Respect
reduced motion. No typewriter delay or automatic scrolling away from text the
person is reading. Failed saves remain visibly unsaved; forward progress waits
for server acknowledgement. Use text animations only when they do not delay
access to the answer.

## 7. Verification and release gates

Build a separate conversation eval while retaining the existing Release B
suite. Include full sequences, not isolated final questions:

- Ordinary → stressful → crisis; ambiguous pronouns referring to medication;
  relationship reflection → disclosure of control; legal emotion → legal advice.
- “You assumed something I never said”; changed user facts; understanding-only
  follow-ups; resource/access limits; requests for predictions or mind-reading.
- Injection in a later turn; repeated requests to override a refusal; multilingual
  follow-ups; ambiguous text; initial general reading with its first question.
- All three journeys through completion, including optional skips, no follow-ups,
  model outage and support routing.

Score final visible answers against `eval/RUBRIC.md`, and assess the whole
conversation for contradictions, repeated wording and invented facts inherited
from earlier assistant turns. Human readers review every stressful case. The
existing agency/honesty floor and blocker rules still apply; an 8/8 reviewer
calibration is not a substitute. Keep known Release B misses as regression
fixtures rather than declaring them fixed by this release.

Integration tests must cover cross-browser access denial, expiration, duplicate
POSTs, concurrent third/fourth submissions, retry exhaustion, late lease writes,
template freezing, idempotent step transitions, no paid GET, cleanup and flags.
Use a real database for transactional invariants. Keep the real stalled-header
and stalled-body tests; record full-pipeline latency in an awake run. Compare
cost per complete conversation including classifier, review, repairs and
failures, not just writer tokens. Settle any allowance change before publication.

Proposed flags: `FOLLOWUPS_ENABLED=false`, `JOURNEYS_ENABLED=false` initially.
New generated follow-ups require the master generation flag, follow-ups flag,
and guest flag when applicable. Disabling follow-ups stops new work but retains
accepted history subject to the master flag/access policy. Disabling journeys
removes new starts while allowing owned runs to resume and finish through
authored fallbacks; it must not reactivate disabled generation. Support responses
remain visible under all combinations. Test these contracts explicitly.

Implement in this order: contracts/fixtures → migration and service with stub →
follow-up UI → conversation eval → journey templates and runs → responsive/end-
to-end checks → protected Preview with real providers → human review → explicit
production enablement. C1 may be released before C2 once its own gates pass.
Use migrations compatible with the deployed B code. Record actual deployment
and review evidence; do not mark unfinished work as enabled or approved. As
with B, Vercel environment changes require a new deployment to take effect.

## Status — 16 September 2026

C1 is built on `feat/release-c` (server `496e8cc`, client `d6bcf82`),
behind `FOLLOWUPS_ENABLED=false`, with the contracts above implemented as
written except where noted: the follow-up answer shape is `paragraphs`
(1–3), `reflection` (nullable) and `beyondSpread` (nullable); the review
pipeline was generalised rather than duplicated; the stub classifier now
distinguishes a request for instruction from a mention so the
pronoun-after-medication case is testable offline. The conversation eval
(`eval/conversations.json`, `npm run eval:conversations`) has been run live.
The `followup.v2` report `eval/report/conversations-2026-09-16T05-59-46-346Z.md`
passed four automated checks, publishing 19/21 follow-ups and routing 4/4
sensitive turns to support. It is not a human quality signoff. Prompt
`followup.v3` replaces v2's worked example, which was the access-limits
fixture itself and whose wording ("a week does not change them", "skipping it
is a fair choice") echoed into answers as claims about time and the cost of
waiting, with a distinct case (feedback given in public) and a rule against
pricing time or inaction. Unseen variants (a deadline that moves, access
arrangements that change, caring duties that change, words for a sibling)
live in `eval/conversations-unseen.json`, run by `npm run
eval:conversations:unseen`, and report separately so the gate set stays
comparable across prompt versions. Under v3 the gate set published 17/21
within the single pipeline attempt the harness then made, while the unseen
set published 8/8; one run does not say how much of v2's result came from
its example, and not every withheld turn was a grounding failure (one was a
limit line over 480 characters, withheld before review).

Bounded pass, 16 September 2026 (uncommitted): production's retry rule
(`GENERATION_MAX_ATTEMPTS`, the request deadline and budget) now lives in
`src/server/generation/attempts.ts` and both production loops and the eval
harness use it, so the harness measures a production submission: a
structurally invalid draft or a provider failure may start one more attempt,
a grounding rejection is terminal, and every attempt's calls are costed. The
report gives both figures, published on the first pipeline attempt and
published within one submission; the 90 % gate is the submission figure.
Mechanical fixes without new editorial rules: the limit line has a writing
target of one or two sentences, about 300 characters, with the 480 hard limit
kept and no automatic truncation; a repair request lists the flagged fields
and requires exactly one replacement each, and the repair tool's schema is
narrowed per call to those fields on all three adapters; a candidate withheld
after repair is printed in the transcript for adjudication. A follow-up
reviewer calibration set of four matched pairs
(`eval/followup-review-fixtures.json`, `npm run eval:followup-review`)
measures false rejections as well as misses: a requested step against an
unsolicited one, an open whether-question against a presuming one, an
acknowledged constraint against a questioned one, an open conditional
against one whose branches supply causes. Prompt `followup.v4` replaces the
long example with two short ones, understanding asked for and a step asked
for, and drops the permission endings that v3's example echoed. Three fresh
sequences (`eval/conversations-fresh.json`, `npm run
eval:conversations:fresh`) are reserved for the final check and were not run
while iterating. The DeepSeek adapter unwraps tool arguments the model
occasionally returns under a single `parameters` key, the cause of the
`output_shape` retries seen in the v4 gate run; the validator still judges
the unwrapped result. The `no_assumed_resource` check no longer flags a
resource the person named themselves.

Results under v4, cached, one run each: reviewer calibration 8/8 in both
directions with the review prompt unchanged (one fixture was corrected to
the library's Hierophant theme after the reviewer rightly objected to it);
gate set 18/21 published within one production submission (86 %, gate not
met), 17 on the first pipeline attempt, 12 with neither retry nor repair,
3 withheld after repair (the crisis opening, the medication mention, the
general-focus first question), all on the presupposition family; unseen
regression set 8/8, 7 with no repair. Two gate turns used the second
attempt after DeepSeek's wrapped arguments; one published through the
Gemini fallback. These are single runs.

Fixed-candidate diagnostic, 16 September 2026 (uncommitted). A writer
switch is on hold: the v4 report does not support a writer-only diagnosis.
Reading the three withheld turns, the low-mood repair could not touch the
reflection the fresh review then rejected, because the first review had not
flagged it and the repair contract rightly forbids editing unflagged fields;
the medication reflection is an open question that permits "no"; and the
family answer makes convention explicitly conditional. So the constraint may
be reviewer consistency, repair quality, or both, and the next experiment
keeps them apart. `eval/repair-cases.json` holds the eight candidates from
the v4 gate run exactly as produced (the three withheld turns and five
published-after-repair turns): complete follow-up input, draft, first-review
findings, repaired candidate and second-review findings, built by
`eval/repair-cases.build.eval.ts`. The initial answers the follow-ups were
written against were not in that report and were regenerated once for the
fixture, marked `regenerated`; reports now carry the complete initial answer
and every published answer so later sets are exact. Each finding carries a
hand adjudication against `eval/RUBRIC.md` (holds, questionable_prose,
should_pass), a first pass for the owner's review. `npm run
eval:repair-diagnostic` re-reviews every identical candidate three times
with unchanged reviewer settings and counts how often each finding recurs
next to its adjudication, then has each repairer named in
`DIAGNOSTIC_REPAIRERS` (default `deepseek,gemini`) repair every draft from
the same issue list under the production contract, with two fresh reviews
of each result. Nothing publishes. `GENERATION_REPAIR_PROVIDER` is a new
optional setting that replaces only the repair call; unset keeps the writer
chain, and it adds no recovery loop.

Diagnostic result, 16 September 2026, Sonnet reviewing, report
`eval/report/repair-diagnostic-2026-09-16T12-08-37-910Z.md` (about 29 cents;
an earlier attempt stopped at two cases when the Anthropic balance ran out).
Reviewer consistency: every finding adjudicated as holding recurred 3/3 on
the identical candidate; findings adjudicated should-pass or questionable
were mixed, from 0/3 (the medication contrast and its open reflection, the
Spanish conditional) to 3/3 (the optional writing step in the prediction
case, which the reviewer consistently reads as unrequested). Two candidates
the run rejected passed 3/3 on re-review (the repaired medication reply, the
Spanish draft), the repaired low-mood reply went 2:1, and one re-review
returned a quote the parser could not locate. So the run's withholding of
the medication and general-focus turns was reviewer variance on borderline
questions, not failed repair. Repair comparison on the same issue lists:
DeepSeek Flash 7/8 applied (one invalid JSON) and 6/8 passed every fresh
review, mean 1.3 s; Gemini Flash 8/8 applied and 6/8 passed, mean 8.6 s and
dearer, with a new presupposition introduced in the low-mood case. No case
for changing the repairer. Cheaper reviewers were calibrated the same day
and both approved the crisis near-miss reading (DeepSeek V4 Pro 14/16
across the two sets, Haiku 4.5 14/16). The owner then removed Sonnet from
every configured role on cost grounds; Gemini 3.8 Flash reviews at
`GEMINI_REVIEW_THINKING_LEVEL=low`, which passed both calibration sets
16/16 including the crisis near-miss, and the gate set 21/21 with all four
sensitive turns routed. That decision, its runs and its open editorial
items are recorded in `RELEASE-C-COST.md`. The reviewer-policy questions
this diagnostic raised (whether a question that permits "no" is a
presupposition, and whether a fresh review may raise a field the first
review did not flag) remain open against the new reviewer. C2 is not
started. This document does not establish the current production flag state.

Server-state review, 16 September 2026 (uncommitted until reviewed): a retry
of a failed turn is refused once a support response has closed the
conversation (`conversation_closed`), while another turn is in flight
(`turn_in_flight`), or when a later message exists (`retry_superseded`), so
no answer is generated without the messages sent after it. Each claim carries
a lease token and every later write on the row is conditioned on it; a worker
that outlives its lease logs `lease_lost` and writes nothing. The daily budget
is charged per paid attempt: the claim transaction pays for the first, so a
denial rolls the claim back and a duplicate read pays nothing; a second
attempt under the same claim pays again or stops with `budget_exhausted`.
The `retryable` flag on a turn is derived from the conversation, so the
client offers Retry only where the server would accept one (the last turn,
conversation open, nothing in flight, the gate open: flags, configuration,
guest pause and the initial answer; a spent allowance does not block it), and a rejected submission
restores the server's view with the message shown outside the form and the
typed text kept. Switching `FOLLOWUPS_ENABLED` off stops new turns but leaves
the history, support responses included, readable. The trace now records why a
draft or a repair failed validation. The follow-up reviewer's input is sent
as two blocks, the frozen reading first (`grounding-followup.v2`, criteria
unchanged), so Anthropic can cache it across a conversation; the saving has
not yet been measured. The conversation report now separates answers
published within one submission from those published without a repair pass,
counts turns that were withheld, failed classification, were routed to
support against the fixture or were never reached separately, and prices the
follow-up spend per generation-eligible turn.

## Current Sonnet-free configuration — 16 September 2026

Sonnet has been removed from the local C configuration at the user’s request.
DeepSeek writes and repairs; Gemini triages and reviews, and is the fallback
writer. Review and all publication checks remain mandatory. See
[RELEASE-C-COST.md](RELEASE-C-COST.md) for the explicit settings, measured
results and remaining release gates. Production settings have not been changed.

## Historical Sonnet cost configuration and measurement — 16 September 2026

Earlier C1 configuration, retained as the cost comparison baseline (superseded above):

```dotenv
GENERATION_PROVIDER=deepseek,gemini
GENERATION_CLASSIFIER_PROVIDER=gemini
GENERATION_REVIEW_PROVIDER=anthropic
GENERATION_REVIEW_MODEL=claude-sonnet-5
ANTHROPIC_PROMPT_CACHE=5m
```

Keep `FOLLOWUPS_ENABLED` off in Production until the release gates pass.
These settings do not require changing the generation prompt or skipping a
review. The API keys for all three configured providers must already exist.
No production settings are changed by this implementation.

The common reviewer system prompt is the first caching target. Anthropic's
five-minute cache write costs 1.25 times ordinary input and a cache hit costs
0.1 times: one subsequent hit repays the premium. A one-hour write costs twice
ordinary input and needs two hits. Traffic per hour alone is not enough to
predict reuse; model, tools, exact prefix and timing matter. Isolated cold
writes can cost more. The runtime default remains uncached. This earlier experiment used five
minutes for the short conversation flow. Verify actual hits.
See [Anthropic caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

DeepSeek caches matching prefixes automatically. The adapter now records
cache-hit input separately from cache misses, rather than pricing both at the
ordinary rate. See [DeepSeek caching](https://api-docs.deepseek.com/guides/kv_cache/).
Both adapters and pipeline totals retain the cache counters, including
Anthropic write TTL. Full prompts, history and safety checks remain intact;
caching reuses input processing, not another person's answer.

Conversation reports now include classification, initial readings, withheld
drafts, repairs and reviews in separate cost tables. They compare the same
observed calls with and without Anthropic caching, so random differences in
repair count do not masquerade as cache savings. Rates in `eval/cost.ts` are
dated estimates, not a bill; unknown models are unpriced. Failed fallback
calls and unreported reasoning may add cost. DeepSeek estimates use peak
rates. Reconcile estimates against provider billing before setting spend caps.

The harness now stops after failed initial triage or an unavailable initial
answer, matching production. Missing turns stay in the publication denominator,
and an unreached sensitive fixture fails its routing assertion. Classification
errors are reported as failures rather than authored support responses. These
changes prevent a cheaper but incomplete run from appearing to pass.

Editorial review of the earlier v2 transcript remains necessary: the changed-
facts reply reopens “or nothing” as something to challenge and assigns discomfort
the person did not state; the access-limits example is also the exact eval
question/cards/latest message, so success there does not prove transfer to an
unseen case. The example is echoed in other replies. Cost work leaves this
prompt unchanged so its editorial revision can be evaluated separately.

Measured cached run:
[conversations-2026-09-16T07-01-38-228Z.md](../eval/report/conversations-2026-09-16T07-01-38-228Z.md).
All four automated gates passed: 19/21 follow-ups published, 4/4 sensitive
turns routed to support, eight follow-up repair attempts, two withheld turns.
Mean turn time, including classification and support turns, was 8.4 seconds;
slowest 16.7 seconds. This was an awake run using `caffeinate -i`.

| Recorded-call estimate | Five-minute reviewer cache | Same calls without reviewer cache | Saving |
| --- | ---: | ---: | ---: |
| Follow-ups, including classification | $0.18522 | $0.29416 | 37.0% |
| Initial readings | $0.07795 | $0.13002 | 40.0% |
| Whole conversation suite | $0.26317 | $0.42418 | 38.0% |

The comparison holds DeepSeek's observed automatic caching constant. Sonnet
reported 90,690 cache-read tokens and 4,461 five-minute cache-write tokens
across the whole run. It is an input-processing saving, not evidence of a
quality improvement or a guarantee at sparse production traffic. Two DeepSeek
invalid-JSON fallbacks were logged; those failed calls are not priced by the
available trace. The figures are for this completed suite, not all experiments
in the session. An earlier command also selected B and was stopped early.

The two heuristic warnings (`no_rushing_claim`, `no_two_offers`) matched
negated statements, illustrating why those checks need a human read. Other
editorial concerns remain, including assumed freedom to delay a decision and
overlong repeated disclaimers. The understanding-only repair remains withheld.
No publication check or prompt was relaxed to produce the savings. Validation:
295 unit tests passed, plus types and lint. No commit, push or production
configuration change was made by this cost pass.
