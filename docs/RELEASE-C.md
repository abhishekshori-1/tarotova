# Release C — follow-ups and guided journeys

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
(`eval/conversations.json`, `npm run eval:conversations`) exists and has
not been run live. C2 is not started. Nothing merged or enabled.
