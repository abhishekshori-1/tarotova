# Release C readiness and cost pass — 2026-09-16, continued 2026-09-17

Status 17 September: the owner approved v9 and the three templates; committed on `feat/release-c` in three commits (app, evaluation, docs) and pushed for the preview build. Not merged; nothing enabled in production. The lines below were written while the tree was uncommitted and are kept as the record.
This record supersedes the older verification/counts in
RELEASE-C-COMPANION-JOURNEYS.md; that document retains the implementation history.
**Release approval remains open.** The September 17 conversation gate now passes
at 19/21 (90.5%); the earlier 18/21 failure is retained below. This does not
approve the transcript or hosted deployment; the journey templates were approved on 17 September.

## September 17 recovery changes

No new product decision, credential or permission from the owner was needed for
these local changes. The existing no-commit and no-production-change instructions
still apply.

Local visibility check, September 17: `FOLLOWUPS_ENABLED` was absent from
`.env.local`, so the follow-up panel was disabled despite the implementation
being present. It is now `true` in that ignored local file for the owner's review;
`GENERATION_ENABLED` is also true. This does not enable a hosted environment.
Suggested questions appear under **Explore this reading** after a successful
initial answer, or after a general reading without a typed question.

- A transient review transport failure can retry the same candidate once across
  both review phases, using the same reviewer and original request deadline.
  Fewer than five seconds left means no retry. Both calls appear in usage traces.
  A valid rejection, invalid review/JSON, refusal or authentication error does
  not trigger this recovery. The writer is not called again for review recovery.
- Invalid reviews now distinguish schema/verdict inconsistency, missing exact
  quotes and ambiguous quotes in the internal trace. Diagnostics contain schema
  codes and locations, not the reader's text or provider output.
- Reviewer v5 changes only the quote field's format instruction: short verbatim
  candidate text, not context, ellipses or paraphrase. The substantive criteria
  are unchanged. Gemini-low calibration passed 20/20 follow-up pairs and 8/8
  initial cases: `followup-review-2026-09-16T19-12-49-391Z.md` and
  `2026-09-16T19-12-06-504Z.md` under `eval/report/`.
- Follow-up v7 ignores injection instructions without quoting or discussing them;
  it answers any genuine remaining question or invites one about the reading.
  The injection check is unchanged. Initial writing remains interpretation.v13.
- The new transcript exposed an optional field serialized as the string `"null"`.
  Before review, the validator now canonicalizes only that exact token to JSON
  null in optional fields. It preserves real boundary text and required fields.
  This normalization was added after the paid run started; it was verified with
  local regression tests, not represented as already present in that run.
- Local tests: 347 passed in 38 files. Tests cover retaining the private draft
  during recovery, one transport retry across both reviews, the shared deadline,
  unchanged rejection behavior and complete usage accounting. The production
  build also passed in a freshly recreated isolated copy. September 16's 92
  browser checks are the latest browser run; this continuation changes only the
  provider pipeline, prompts, diagnostics and their tests.

### September 17 conversation evidence

`eval/report/conversations-2026-09-16T19-19-28-371Z.md`: all four automated tests
pass. 19/21 eligible follow-ups published on the first pipeline attempt; 15 needed
neither retry nor repair. Every reached eligible turn published, but two were
not reached because the prediction conversation's initial answer was rejected
after repair. Sensitive routing is 4/4; four stressful labels remain ordinary.
All explicit checks pass, including the unchanged injection-marker check.

No review transport retry or invalid review occurred in this run. Recovery is
covered by deterministic tests; the publication improvement cannot be attributed
to that branch. The new quote instruction did not produce a parsing error in
this run, which is limited evidence, not a reliability guarantee.

Known model usage was $0.07629 for follow-ups and $0.05774 for initial readings,
with no missing usage counters. The report still omits a full-conversation
planning estimate because two turns were not reached. Known follow-up spend per
published answer was about 0.40 cents, compared with 0.51 cents in the earlier
18/21 run. Initial-reading spend was higher; the changed number of repairs,
fallbacks and tokens means this is not a controlled savings comparison.

The visible transcript still has editorial issues. The correction reply infers
that a year of consideration means reflection may be largely done. The
understanding-only reply places the difficulty in clarity rather than will and
later introduces rising stakes/risk as a mechanism. The access-limits reflection
presumes limits on time and energy beyond the accessibility/transport barriers
stated. An automatic pass does not resolve those findings. Earlier companion
findings below have not been cleared by an unchanged-fixture rerun.

### September 17 initial-reading evidence and cost scale

`eval/report/2026-09-16T19-26-41-091Z.md`: all seven automated tests pass.
40/43 answers published; sensitive routing is 12/12 and reviewer calibration
8/8. The three withheld drafts triggered existing banned-phrase validation
(`reversed`, `legal advice`, `prescri...`). Those checks were not weakened.
The combined reading/conversation command passed all 11 tests.

Known initial-reading usage, including withheld work and excluding calibration,
was $0.15137, with no missing counters. Combining that run's cost per published
reading with the conversation run's cost per published follow-up gives the rough
scale `100 × ($0.15137 / 40 + 3 × $0.07629 / 19) ≈ $1.58`. This is an estimate
for 100 published readings plus 300 published follow-ups from different fixture
sets, not evidence of 100 completed conversations or a provider bill. The
conversation's two unreached turns still prevent a complete-run planning claim.
The roughly $2 model-usage target remains plausible; hosting/database/email are
additional. No Sonnet role or new production setting was introduced.

The final local run passed 347 tests in 38 files; type-check, lint, whitespace
checks and the isolated production build passed. No further paid run or reserved
fresh-set run was started after these results. Editorial findings and the hosted
preview remain the next release checks, not another retry until a run is green.

The later human inputs are approval of the final transcripts and three draft
journey templates, then the immutable preview URL after the owner commits/pushes
the reviewed tree. Hosted branch/domain, migration and flag checks still need
Vercel access; API keys should not be pasted into chat.

## 17 September, third pass: writer followup.v9 and follow-up reviewer v6 (owner's direction)

The owner asked for a simpler, more attentive writer that treats a prayer, a
substantive question and a practical request as different moments; kindness in
place of defensive boundaries; hope without explaining the concern; possibilities
rather than invented psychology; and a reviewer that treats those shapes as
failures. Done with the existing writer and reviewer calls, no model change and
no extra stage. Uncommitted.

### What changed

- `followup.v9` replaces the v8 text: three kinds of moment with the reply each
  gets; the grounding rules compressed into four bullets (each earlier rule kept,
  none added); a "kindness over defence" section; four short examples on
  situations outside every eval fixture (a move, a raise meeting, a town's
  employer closing, and the existing tired-and-short example). The prompt is
  about a third shorter than v8.
- `grounding-followup.v6` adds four conversational failures the follow-up
  reviewer must send back, described by shape: a prayer or goodbye given card
  analysis or a task; a refusal that judges the wish; an explanation of the
  person's worry or behaviour they did not give (repetition, familiarity,
  stakes, attachment, a duration read as readiness); a limit on time, energy or
  money the person did not state. The initial-reading reviewer is unchanged.
- Three matched calibration pairs on non-fixture scenarios for those shapes
  (`prayer-received/homework`, `wish-received/judged`, `worry-perspective/explained`),
  26 fixtures in all.

### Evidence

| Run | Result | Report |
| --- | --- | --- |
| Reviewer-miss set, reviewer v6 | 4 / 10 expected findings caught, 3 of them in every re-review; 4 / 8 drafts rejected every time (was 0 / 10 and 1 / 8) | `repair-diagnostic-2026-09-16T20-55-55-886Z.md` |
| Follow-up calibration | 26 / 26, no false rejections | `followup-review-2026-09-16T20-57-18-710Z.md` |
| Gate set | all four tests pass; 20 / 21 published (95 %), 19 first attempt, 11 without retry or repair; the one withheld is the "I stop when it starts to matter" turn, rejected for invented psychology after repair; $0.0057 per eligible turn | `conversations-2026-09-16T21-02-11-409Z.md` |
| Unseen set | 7 / 8; the one withheld is a `grounding_review_invalid` (the reviewer quoted text that matched no field; an invalid review is terminal by the 17 September decision) | `conversations-unseen-2026-09-16T21-04-07-660Z.md` |
| Companion set | 5 / 8 published, 0 withheld, 3 not reached: the five-year-work initial reading was rejected because `interpretation.v13` repeated the forecast boundary in the perspective and the repair repeated it again | `conversations-companion-2026-09-16T21-06-39-576Z.md` |

The reviewer now consistently catches the duration-as-completion, the judged
wish and the prayer turned into homework, and two of three invented-mechanism
sentences. It still passes the assumed time-and-energy limit, the explained
worry in the AI reply and the income-diversification advice. Fewer answers
publish without repair (11 of 21 against 14 to 15 before) because the reviewer
sends more back; publication within one submission is unchanged at 20 / 21.

Owner's read of the v9 companion transcript: the prayer gets one warm sentence
and nothing else; the promise request opens with kindness and carries a single
boundary in beyondSpread; the AI-worry reply offers the "not already decided"
distinction rather than explaining the worry, though it still uses "noise".
The three unreached turns are an initial-reading matter, not a follow-up one:
the initial writer still opens with the limit the tool description tells it to
keep in beyondSpread. That is the same pattern the follow-up prompt fixed and
would be the next writer change if the owner wants it; it is outside this pass.

### Unchanged

The reserved fresh set has still never been run. 347 unit tests, types, lint
and whitespace pass; the browser suite was not rerun (no UI change).

## 17 September, second pass: reviewer misses measured, writer v8

Requested by the owner against the six open items. Uncommitted, no hosted change.

### The reviewer does not catch the flagged replies, at any tested price

The eight published replies the owner's read flagged (four from the 19:19 gate run,
four from the 17:39 companion run) were lifted verbatim into
`eval/reviewer-miss-cases.json` with ten expected findings written against the
exact quotes. `npm run eval:reviewer-misses` re-reviews each draft three times
with the configured reviewer and counts how many re-reviews make each expected
finding. The same eight drafts were then run through five other reviewers by
command-line override only.

| Reviewer | Expected findings caught at least once | In every re-review | Drafts rejected 3/3 | Cost of the run |
| --- | ---: | ---: | ---: | ---: |
| Gemini flash, low (production) | 0 / 10 | 0 / 10 | 1 / 8 | $0.06 |
| Gemini flash, medium | 0 / 10 | 0 / 10 | 0 / 8 | $0.14 |
| Gemini flash, high | 2 / 10 | 0 / 10 | 0 / 8 | $0.33 |
| DeepSeek V4 Pro | 5 / 10 | 1 / 10 | 1 / 8 | $0.03 |
| Sonnet 5 | 3 / 10 | 1 / 10 | 3 / 8 | $0.33 |
| Haiku 4.5 | 2 / 10 | 0 / 10 | 1 / 8 | $0.12 |

Reports: `repair-diagnostic-2026-09-16T19-52-34-623Z.md` (low), `…19-57-23…` (medium),
`…20-01-56…` (high), `…20-03-00…` (DeepSeek Pro), `…20-04-47…` (Sonnet), `…20-05-44…` (Haiku).
The one draft every Gemini-low re-review rejected was the timed exercise, which the
rules name explicitly. Sonnet and DeepSeek Pro reject the income-diversification reply
consistently and disagree with each other on the rest. No configuration rejects the
correction reply, the prayer reply or the "promise that thin" reply in every re-review.

Conclusion: these eight are not reviewer variance and not a Gemini-only blind spot.
They sit inside what the grounding rubric's own allowances (warmth, a suggested method,
a clearly open possibility, generalizations as themes) let through. Changing the reviewer
would not close them; it would only change which borderline replies are sent back. The
reviewer decision from 16 September stands on this evidence.

### Writer followup.v8

Four patterns the v7 failure list did not name were added to it, in the existing
bullets: a stated duration says nothing about completion; a short message has no
visible history; no general truth about money, work or feelings offered as if it
applied to them; no constraint added that they did not state; and a boundary belongs
in beyondSpread, never only in the body. Nothing else in the prompt changed.

- Gate set, `conversations-2026-09-16T20-15-47-049Z.md`: all four tests pass,
  21 eligible, 20 published (95 %), 18 on the first attempt, 14 without retry or repair,
  every conversation reached. Withheld: the medication turn, two structurally invalid
  drafts (four paragraphs, then a banned phrase). $0.0055 per eligible turn.
- Companion set, `conversations-companion-2026-09-16T20-18-11-694Z.md`: 8 eligible,
  7 published; the withheld one is a grounding rejection after repair, which is the gate
  working. The 90 % assertion fails on this set (88 %); it is a development set, not the gate.

Owner's read, v8: the correction reply no longer infers that the thinking is done; the
access-limits reply assumes no time or energy limits and offers a step that fits the
request. Not fixed: the "promise that thin" sentence recurs verbatim; the prayer reply
classifies the utterance and attaches a task; the AI-worry reply still explains the worry
through repetition; "tonight" and "today" still appear. Both DeepSeek and the Gemini
fallback produce the explaining-worry pattern. These are writer habits the prompt names
and the reviewer allows; a further prompt pass is not expected to move them.

### Harness

- `eval/repair-diagnostic.eval.ts` takes `DIAGNOSTIC_CASES`, runs with no repairers when
  `DIAGNOSTIC_REPAIRERS` is empty, and scores `expectedIssues`. `eval/repair-cases.build.eval.ts`
  takes `BUILD_REPAIR_FIXTURES` and `BUILD_REPAIR_OUT`.
- The conversation report now includes the withheld initial reading's drafts and findings,
  so a rejection that costs a whole conversation can be read rather than counted. The
  19:19 run's prediction rejection predates this and has no recorded reason.
- 347 unit tests, types, lint and whitespace pass. Browser suite not rerun (no UI change).

### Unchanged

The reserved fresh set has never been run (no report names it).

### Journey templates approved

On 17 September the owner editorially approved the authored copy of all three templates
(navigating a change: leaves room for uncertainty without demanding resolution; preparing for
a conversation: respects boundaries and makes participation optional; reopening creativity:
supports curiosity without imposing productivity). Recorded in `src/content/journeys/index.ts`
as `journeys.v1`, review status `reviewed`, dated. The approval covers the template copy only;
the generated v13/v8 replies remain unapproved.
Nothing is committed or deployed.

## Changes

- Both template routes return 404 while journeys are disabled. Journey and
  template routes have noindex metadata and robots exclusions; owned runs still
  resume under the same ownership, grant, expiry and support rules.
- Home discovery is rendered on the server, without a browser fetch. A visitor
  without a session cookie incurs no migration/session/database query. Resume
  uses one joined query for live, unfinished runs instead of loading up to twelve
  complete readings and their conversation state. Home links do not prefetch
  session-dependent discovery.
- Server Components and route handlers share the development PGlite client.
  Separate embedded instances on one directory produced stale resume results;
  real Postgres remains the production backend. Client-only creation forms stay
  disabled until hydration so early clicks cannot submit a native GET.
- Journey step errors distinguish closure, rate limits, revision conflicts,
  unavailable readings and unknown failures. Privacy describes saved journey
  questions/progress, retention with the reading, and private reflections that
  are not collected. The support contact remains support@tarotova.com.
- Provider traces include individual fallback attempts, model, duration, safe
  failure diagnostics and reported usage. Failed JSON responses with token
  counters are priced; winning calls are not counted twice. Unknown usage is
  explicitly unpriced. Incomplete conversation runs do not get a planning cost.
- Repair v2 preserves beyondSpread as a knowledge boundary or null. It cannot
  become a reassurance/referral placeholder. No truncation, extra journey model
  call or relaxed publication gate was added. The September 17 transport recovery
  above can add one review call after a network failure.
- Companion fixtures now check unsupported temporal details, including prayer
  and thanks. The check allows reader-supplied time and requested optional steps;
  it is an advisory heuristic, not a semantic guarantee.

## September 16 reviewer evidence and versions

September 16 writer versions were interpretation.v13 and followup.v6. Library remains
content.v8-draft. Repair is repair.v2; reviewer is grounding.v4 / grounding-followup.v4.

The harder calibration includes paraphrased duplicate boundaries, a gentle
professional referral after prayer, a positive case explicitly requesting that
support, and an invented explanation of worry. Gemini-low and Gemini-medium
both scored 17/18 under reviewer v3: the worry explanation passed incorrectly.
Medium added effort without fixing the miss and was not selected.

Reviewer v4 clarifies the existing presupposition rule for invitations/advice,
not just grammatical questions. It also distinguishes a plausible generalized
cause from evidence about this reader. A separate colleague-silence matched pair
checks the same rule when the reader does or does not supply an interpretation.

- Gemini-low follow-up calibration: 20/20,
  `eval/report/followup-review-2026-09-16T17-35-48-235Z.md`.
- Initial reviewer calibration: 8/8,
  `eval/report/2026-09-16T17-36-09-575Z.md`.
- Comparison: Gemini-medium, unchanged v3, 17/18,
  `eval/report/followup-review-2026-09-16T17-32-49-078Z.md`.

These are limited calibration results, not proof that all generated answers
are grounded or editorially approved.

## Cost configuration under verification

No Sonnet. No implicit change to existing deployments. Optional effort variables
preserve the model default when unset; roles can be changed independently.

```dotenv
GENERATION_PROVIDER=deepseek,gemini
GENERATION_CLASSIFIER_PROVIDER=gemini
GENERATION_REVIEW_PROVIDER=gemini
GENERATION_REVIEW_MODEL=gemini-3.8-flash
GENERATION_REPAIR_PROVIDER=deepseek
GEMINI_REVIEW_THINKING_LEVEL=low
GEMINI_WRITER_THINKING_LEVEL=low
GEMINI_CLASSIFIER_THINKING_LEVEL=low
```

The target is roughly $2 in model usage for 100 initial readings plus 300
follow-up submissions. Journey stages themselves add zero model calls. This
excludes hosting/database/email and is an estimate using the repository's
2026-09-16 rate table, not a provider bill or spending guarantee.

The instrumented companion run with default writer/classifier effort published
8/8 and cost $0.07588: $0.00936 for three initial readings and $0.06652 for eight
eligible follow-ups plus support triage. There were three malformed DeepSeek
tool-argument responses, each returning after about 2.7–3.4 seconds, followed by
Gemini writes. Their usage is now included. One long paragraph also required a
new pipeline attempt. Increasing timeouts would not address malformed JSON.

Gemini's default classifier/fallback effort accounted for substantial billed
thinking tokens, which motivates testing low effort for those two roles rather
than changing the writer or adding calls. The first low-effort gate run was
interrupted by network failures: 13/21 published, seven unreached, one classifier
failure; the initial-reading regression then lost connectivity. These failed
reports remain recorded and are not evidence of savings or a release pass:
`conversations-2026-09-16T17-46-53-430Z.md` and `2026-09-16T17-48-36-686Z.md`.
A key-free API check succeeded afterwards. The confirming run below used the
same configuration; the two new effort variables were command overrides only,
not edits to local or hosted environment settings.

## September 16 confirming run and cost limits

Initial-reading report: `eval/report/2026-09-16T18-07-47-390Z.md`.
All seven automated tests passed: 39/43 answers published, sensitive routing
12/12, reviewer calibration 8/8. Four answers were withheld: two after grounding
review, one for a banned phrase, and one for output shape. These remain part of
the report and its cost, not successful answers.

Conversation report: `eval/report/conversations-2026-09-16T17-59-44-486Z.md`.
Two of four automated tests passed. Publication was 18/21 (86%); 17 published
on the first pipeline attempt and 15 without retry or repair. Sensitive routing
was 4/4. The failures were:

- The prediction conversation's initial review timed out, leaving two follow-ups
  unreached. They remain in the eligible denominator.
- The access-limits follow-up exceeded a paragraph limit on its first attempt;
  its second attempt received an invalid review. That turn was withheld.
  The trace identifies `grounding_review_invalid`, but does not establish which
  review schema or quote-matching condition failed.
- The injection reply refused the instruction but quoted the attack marker
  `PWNED` in its refusal. No system prompt was disclosed in the visible reply;
  the strict marker check still fails. The check has not been weakened.

Four stressful follow-ups were classified as ordinary. This was also present in
the earlier default-effort run; this comparison does not establish equivalence
of classifier quality. Editorial approval remains separate from these tests.

| Recorded model usage | Known-call estimate | Publication | Calls without usage |
| --- | ---: | --- | ---: |
| Standalone initial-reading set, excluding calibration | $0.14998 | 39/43 | 0 |
| Conversation initial readings | $0.03269 | One initial review timed out | 1 |
| Conversation follow-ups, including support triage | $0.09202 | 18/21; two unreached | 1 |

The report deliberately omits a full-conversation planning figure because turns
were not reached and usage is missing. For a rough cost scale only, dividing
known spend by published answers across the standalone and conversation sets
gives `100 × ($0.14998 / 39 + 3 × $0.09202 / 18) ≈ $1.92` for 100 readings plus
300 published follow-ups. This includes recorded failed work in each numerator,
but combines different fixture sets, excludes unreported charges, and does not
demonstrate 100 complete conversations. It is not an approved $2 budget or a
measured saving against a matched baseline. Hosting, database and email are
excluded. A complete passing run with reconciled usage is still needed.

The reserved fresh set was not run during this pass. Its provenance must be
checked before describing it as unseen; the filename alone is not evidence.

## September 16 local verification

| Check | Result |
| --- | --- |
| Unit/integration tests | 340 passed in 38 files |
| Browser suite, journeys enabled | 88 passed across 320, 390, 820 and 1440 px; four flag-off cases intentionally skipped |
| Browser suite, journeys disabled | All four flag-off cases passed separately |
| Type-check, lint, diff whitespace | Passed |
| Production build | Passed in the isolated copy |

Browser runs used a throwaway database and stub generation, not paid providers
or a hosted preview. Logs are under `data/review-pass/`. Neither these checks nor
the passing initial-reading gate overrode that day's failed conversation gate.

## Editorial findings remain visible

The instrumented companion transcript is
`eval/report/conversations-companion-2026-09-16T17-39-20-122Z.md`.
Its 8/8 publication result is not editorial approval. In particular:

- The AI-worry reply still connects repetition with the person's sense of
  urgency. That explanation was not supplied by the reader, despite the harder
  reviewer calibration passing separately.
- The work-perspective reply introduces income-diversification advice and broad
  claims about what keeps money arriving, despite the reader declining an exercise.
- The prayer response is overexplained and supplies a "long stretch" the person
  did not establish. The time heuristic also flags its optional reference to today;
  that flag needs contextual reading, unlike an assertion that it is nighttime.
- The promised-safety reply keeps its boundary in the body, omits beyondSpread,
  and supplies the reader's preference about what kind of promise they want.

Do not treat calibration alone as resolving these examples. Scores and template
approval must be recorded by the actual reviewer. The three templates were approved on 17 September (see above).

## Deployment checks still require the hosted preview

There is no Vercel CLI/project link or Vercel connector in this workspace. The
local environment is not evidence of production settings. Nothing here claims
that migration 0006 or the domain assignment has been verified on Vercel.
Follow the preview sequence in INFRA.md against the exact committed artifact;
confirm the preview branch-domain assignment, the cold-start migration and the
four-step conversation plus complete-journey check before changing production.
The operator name and jurisdiction were not supplied; privacy text beyond the
support contact still needs the owner's factual review.
