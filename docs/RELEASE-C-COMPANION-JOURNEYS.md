# C1 conversation and C2 guided journeys — implementation review

The [readiness record](RELEASE-C-READINESS.md) supersedes the test counts and
release evidence below. This document retains the implementation history;
the latest automated pass does not clear the outstanding editorial findings.

16 September 2026. Requested together after a real reader sample showed repeated
limits, circular follow-ups and a dismissive reply to a prayer. Uncommitted;
no production flag, deployment or provider configuration changed.

## Experience

C1 distinguishes the reader's words, the response and an optional reflection.
The composer retains a three-turn allowance, explicitly submitted suggestions,
visible waiting/recovery states and a calm ending. The retention notice appears
once. Necessary limit text remains visible; it is not hidden or stripped by a
client heuristic. Existing frozen answers are never silently rewritten.

The writing target is developed replies to substantive questions, with a new
contribution each turn. Acknowledgments and prayers can end naturally without
another card analysis or a referral. Hope means room for understanding, a real
possibility or an optional approach, not a guaranteed outcome. The writer prompt
versions are interpretation.v13 and followup.v6. Grounding v3 also checks
repeated limits, dismissive referrals and unsupported reassuring assertions.
The original safety categories, deadlines, allowances and provider roles remain.

C2 supplies three versioned draft templates: navigating a change, preparing for
a conversation, and reopening creativity. Public previews explain the whole
experience before creation. The owned run moves through Frame, Explore, Reflect
and completion, using one existing draw and the same follow-up allowance.
Clarification is optional guidance for editing the question, never an inferred
addition. Completion stores no reflection note and makes no model call.

The interface works without follow-ups or generated output, using authored
content once the reading is safely displayable. A support response replaces
journey action prompts and remains visible with flags off. Standalone revisits
also show stored follow-up support before old card advice.

## Persistence and operation

Migration `0006_guided_journeys.sql` adds `journey_runs` and a transition replay
ledger. Run creation and draft creation commit atomically. Duplicate submission
IDs return the existing run without another creation charge; conflicting input
fails. Creation shares the existing reading session/IP rate limits. Transitions
serialize on the reading row, require a revision and submission ID, and return
current state on an acknowledged replay without applying it again. A failed save
does not advance the UI. Going back never unlocks the question or cards.

The template snapshot is frozen. Expiry is derived from the reading's draft
window or active grant rather than a second, potentially divergent clock.
Cleanup deletes runs before readings; transition history cascades from its run.
Access is confined to the owning browser. Verification preserves the run and
returns to it. Home offers active owned runs; that discovery request does not
create a competing session while a first reading is being started.

`JOURNEYS_ENABLED=false` is the default. It stops new runs, while existing runs
can resume and finish. It does not enable generation. The three template review
records are honestly marked draft: no practitioner/editorial approval is invented.

## Cost

No generated journey intro, summary, suggested-question call or completion call.
The maximum paid path remains one initial reading plus three follow-ups.
Changing reply lengths or increasing legitimate repairs can change observed
costs; the earlier $1.67/100-conversation estimate is not a guarantee for these
new prompts. Provider roles remain DeepSeek writer/repairer, Gemini classifier,
Gemini low-thinking reviewer, Gemini fallback writer. No Sonnet was reintroduced.

## Evaluation evidence

The new `eval/conversations-companion.json` is a development regression set,
not a fresh holdout. It contains the reader's AI worry/prayer sequence plus
future-of-work and conversation examples. Existing gate and holdout fixtures
are not rewritten to fit the prompt. Four reviewer calibration fixtures add
matched pairs for duplicated boundaries and inappropriate medicalization of prayer.

Early writer-only experiments published 8/8 but still repeated boundaries and
introduced unsupported reassurance. Their automatic passes are not editorial
approval. This motivated an explicit check in the existing reviewer rather
than concealing repeated text in the UI. Final verification results follow below.


### Current editorial read

Final companion regression:
[report](../eval/report/conversations-companion-2026-09-16T16-05-22-639Z.md).
8/8 eligible replies published, seven without repair. The abuse disclosure
routed to authored support. The prayer received a brief acknowledgment with no
medical referral or repeated prediction disclaimer. Necessary boundaries still
appear for newly pressed unsupported promises.

This is a partial improvement, not an editorial pass. The work-future answer
still presumes the person's expertise and explains worry through attachment to
a particular version of work. The children's-future answer reframes their fear
as repeated information becoming believable. Both deserve a low grounding
score; the reviewer let them through. Some initial responses still frame the
reading defensively. `no_task` also matched the noun “schedule”; that particular
heuristic match is not proof of an assigned task. Stressful/ordinary mismatches
remain advisory. Do not treat publication as evidence these concerns are fixed.

Estimated whole companion run: $0.07073. Follow-up work $0.05670 / 8 eligible
turns, initial work $0.01403 / 3 readings. Different fixtures and fallback rates
make this unsuitable for claiming savings against the earlier gate-set run.

Local `JOURNEYS_ENABLED=true` makes the combined interface available for review.
Production is unchanged. Template records remain draft and the revised generated
voice remains subject to a human pass; previous approvals covered earlier text.

### Final verification

- 329 unit tests in 36 files pass, including transactional journey/cleanup and
  HTTP ownership/schema tests. Types, lint and diff whitespace checks pass.
- 84 browser checks pass across 320px, 390px, 820px and 1440px viewports. They
  exercise all three journeys, refresh, same cards, optional follow-ups,
  generation failure, support closure and standalone support persistence. These
  are Chromium viewport checks, not native iOS/Android certification.
- Production build passes in the isolated copy. The initial sandbox build
  failed on font/network access and cached a Turbopack permission error; the
  clean build with permissions passed. No live dev database was touched.
- [Conversation gate](../eval/report/conversations-2026-09-16T16-12-01-815Z.md):
  all four tests pass; 21/21 eligible turns published, 20 on the first pipeline
  attempt, 15 with neither retry nor repair; sensitive routing 4/4. Four
  stressful/ordinary mismatches remain. No Sonnet calls.
- [Follow-up calibration](../eval/report/followup-review-2026-09-16T16-12-50-075Z.md):
  12/12, including the new matched pairs.
- [Initial reviewer calibration](../eval/report/2026-09-16T16-12-21-627Z.md):
  8/8. This was reviewer-only; the 43-answer initial-reading set was not rerun.
  The conversation gate did generate its 12 initial readings. The old fresh
  set was not rerun in this pass; older approvals do not cover the revised text.

Gate-set estimated spend: $0.11325 follow-ups / 21 eligible turns, and $0.05142
initial work / 12 readings. Projected reading + three follow-ups is $0.02046,
or about **$2.05 per 100 complete conversations**. This is higher than the
previous $1.67 estimate, with six follow-up repairs rather than two and different
output/usage. It remains an estimate excluding unreported failed-call charges
and infrastructure. Authored C2 stages add no model calls.

Implementation is ready for code review, not an assertion that generated prose
has passed the new editorial gate. The concrete concerns above remain visible
in the report. New template review metadata remains draft. Nothing committed,
merged, deployed or enabled in production by this implementation pass.
