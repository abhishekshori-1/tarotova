# Reading experience: implementation checkpoints

**Historical design/completion checkpoints.** The current uncommitted candidate
and the owner's later 85% publication decision are recorded in the
[85% checkpoint](READING-EXPERIENCE-85-CHECKPOINT.md).

17 September 2026. Implements docs/PLAN-READING-EXPERIENCE.md up to the
initial checkpoint and the subsequent completion pass authorized by the owner. Working tree only, on
`feat/release-c` after `c6d2a9e`. Nothing committed, deployed or enabled.

## Current completion pass — 17 September

**Local fixes implemented, uncommitted. Production readiness is still open.**

The previous second-pass acceptance has been extended by the owner's request
"can you fix this?" No changes have been committed, pushed, deployed or enabled.
Detailed evidence and the remaining sequence are in
[READING-EXPERIENCE-FINAL-CHECKS.md](READING-EXPERIENCE-FINAL-CHECKS.md).

- All 22 faces now have illustrated compositions; the approved back is retained.
  The Star's kneeling pose was revised. [Complete deck](screens/reading-experience/deck-complete.png).
- Longer card text renders as real paragraphs, with a reading column that adapts
  to its available width. Small-phone and landscape-tablet reflow at 200% text,
  Safari focus return and the short-landscape card dialog were corrected.
- DeepSeek now uses its documented strict tool schema and fixed position keys.
  Three targeted live cases passed shape validation. The strict parser still
  rejects missing/extra content; the stored shape, length limits, review and
  deadline remain in force. No extra model call was added.
- `interpretation.v18`, `followup.v11`, `grounding.v8`,
  `grounding-followup.v9`, `repair.v4` are the current candidate. The longer
  initial explanations and claim checks are **not accepted**. The resumed
  initial run publishes 39/43 and passes its automated gate; the conversation
  run publishes 17/21 and fails. Editorial spot checks still find invented
  explanations and assumed control over circumstances.
- The owner removed the Gemini spending cap. A minimal request succeeds and
  the resumed calibration passes 10/10 initial-reading and 26/26 follow-up
  controls. The full reading and conversation checks are complete; the earlier
  HTTP 429 run remains recorded separately from judgement results.
- Depth is inconsistent: only 16/38 published English initial readings are in
  500–650 words. All published English follow-ups meet their labelled ranges,
  but four eligible turns are withheld and remain in the publication denominator.
- The original reserved fresh set has not been run. Two further full-length,
  three-follow-up conversations are reserved in `conversations-depth-heldout.json`.
- No hosted verification has been claimed. An immutable preview containing these
  uncommitted changes is still needed. Browser emulation does not certify
  physical iOS/Android devices or field Web Vitals.

The resumed estimate is **~$2.83 per 100 readings plus three published
follow-ups each**, including failed and withheld work, above the $2.20
threshold. The earlier ~$2.06 estimate remains historical. Editorial scoring
of the initial set is partial and already identifies blockers; no full human
pass is claimed. Sonnet has not been added; no provider budget or production
setting has been changed by the assistant.

## First checkpoint archive

The sections below retain the earlier implementation history and numbers;
the current status above takes precedence.

## What was built at the first checkpoint

**Art.** A finished card back and three face studies (The Fool, The Star,
The Tower) as hand-authored SVG in the midnight-observatory direction;
provenance in [ART-PROVENANCE.md](ART-PROVENANCE.md). The other 19 faces
keep the Release A baseline until the direction is approved. The Tower keeps
the source image's falling figures, drawn small and calm, so the art agrees
with the library text. Side by side: [card-studies.png](screens/reading-experience/card-studies.png).

**Screens.** Home shows the three-card composition at every width, with a
panel composer. Choose is a card table with a legible position tray. The
reading is one editorial page: a large labelled spread that indexes the page
(a card links to its section and enlarges in an accessible dialog), an
opening, three developed card sections with the library material collapsible
beneath, "How the cards connect", one reflection, then the conversation with
an "Ask about this reading" control that jumps to and focuses the existing
composer. Desktop keeps a sticky rail with the spread and section links beside
a 55–70 character column; phone gets a scrollable row of section pills.
Journeys have distinct Frame, Explore, Reflect and keepsake Complete
compositions using saved content only. Body text is 18 px at 1.7 leading;
transitions are 150–300 ms and reduced motion removes them.

Screenshots from the stub build, phone 390 px and desktop 1440 px, in
[screens/reading-experience/](screens/reading-experience/): `baseline/` is
commit `c6d2a9e`, `candidate/` is this tree.

**Longer content, one shared contract.** `src/server/generation/lengths.ts`
holds every limit and word target; schemas, validation, prompts, repair and
the eval reports read it. Readings gain a required `synthesis`; old stored
answers normalise to `synthesis: null` and render without that section.
Follow-ups allow up to five paragraphs. Repairs are checked against the
destination field's own limit. Prompts are `interpretation.v14` and
`followup.v10` (v9 text with only the length lines changed); reviewer field
enums are `grounding.v6` / `grounding-followup.v7`, repair `repair.v3`.
DeepSeek budgets: 2,400 tokens for initial writing and repair, 1,600 / 1,800
for follow-up writing and repair.

**General readings.** Each of the 22 cards has an authored 80–110 word
exploration in the library's stance, frozen into the lock snapshot; the
overview connects the three positions by keyword instead of repeating core
meanings. Assembled general readings measure 539–610 words (median 567) over
88 card/focus combinations. Content is `content.v9-draft`; the practitioner
review has not happened.

**DeepSeek JSON mode.** The first confirming run lost 5 of 43 readings to
invalid tool-argument JSON and 4 more to the model inventing keys or a fourth
card. The adapter now asks for `response_format: json_object` with the schema
in the system message, still accepts a tool call or a fenced block, and the
prompt states the exact output shape. The validator is unchanged.

## Evidence

| Run | Result | Report |
| --- | --- | --- |
| Initial set, v14 with tool calls | 20 / 43 published; 5 invalid JSON, 4 shape drift, 1 classifier call hung 208 s | `eval/report/2026-09-17T06-13-26-161Z.md` |
| Conversation gate, same time | network failure (13 × ENOTFOUND), not evidence | `eval/report/conversations-2026-09-17T06-13-31-626Z.md` |
| Initial set, JSON mode | 36 / 43 (84 %); 3 `prescri`, 2 invalid JSON, 1 missing keys, 1 asserted certainty; median 528 words, 4 / 36 in 600–750 | `eval/report/2026-09-17T07-33-28-553Z.md` |
| Conversation gate, v10 | all routing tests pass; 18 / 21 published (86 %), 3 grounding rejections after repair; 12 / 16 substantive replies in range; $0.0062 per eligible turn | `eval/report/conversations-2026-09-17T07-39-56-371Z.md` |
| Initial set, firmer per-card target | all 7 tests pass; 39 / 43 (91 %); median 549 words (436–708), 6 / 39 in 600–750; every answer has a synthesis; $0.17611 known spend | `eval/report/2026-09-17T07-49-24-408Z.md` |

Local checks: 358 unit tests in 39 files; 88 browser checks at 320, 390, 820
and 1440 px plus the four flag-off checks; types, lint and whitespace pass.
Browser runs use the stub provider, so they do not exercise the longer prose.

## Second pass, 17 September: the owner's checkpoint decisions applied

Decisions received: palette and card back approved; the three faces to be
revised before the remaining 19; 500–650 words accepted for the reading subject
to editorial scoring, with no inflation of the prompt's range; the 90 % gate
retained; the two published readings that opened on the limit or narrated the
request to be corrected; the $2 target and no-Sonnet configuration kept, with
avoidable repair and review work reduced before any vendor change.

**Done.**
- "Ask about this reading" and the "Conversation" section link now appear only
  when the follow-up panel reports that its composer is on the page, so the
  control can never point at nothing.
- Every generation-eligible fixture turn carries a `kind` (substantive,
  practical, acknowledgment); the report measures each turn against its own
  range and never infers the kind from the answer's size. A tiny answer to a
  substantive turn is out of range.
- Phone screenshots regenerated after the overflow fix: the page fits the
  viewport, and the section index is a scrollable row. All candidate screenshots
  under `screens/reading-experience/candidate/` are from this pass.
- The three faces redrawn as filled figures with real proportions, layered
  scenery and RWS detail: [card-studies.png](screens/reading-experience/card-studies.png).
  The Star's kneeling pose is still the weakest of the three.
- `interpretation.v15`: one line that the perspective never opens with what the
  cards cannot do, and one that "What now?" and its kin ask for a step and that
  the writer never tells the person what they did or did not ask. Targets
  500–650 whole, sections 80–110 / 110–140 / 80–110 / 20–35. `grounding.v7` /
  `grounding-followup.v8` name the opening-with-the-limit shape and the
  narrated-request sentence as failures. Follow-up prompt unchanged.
- Gemini classifier and fallback writer at low effort for the run (the
  configuration the readiness record lists); the reviewer was already low.
  Gemini's implicit prefix cache never hits on our review request: three
  identical review calls reported zero cached tokens, as every report to date has.

**Confirmation run** (`conversations-2026-09-17T08-15-58-533Z.md`,
`2026-09-17T08-26-00-499Z.md`), same fixtures, models and accounting as before:

| Measure | Before this pass | Now |
| --- | --- | --- |
| Conversation gate | 18 / 21 (86 %), 3 grounding rejections | 19 / 21 (90 %); 1 paragraph over 1,100 characters twice, 1 Spanish duplicated boundary |
| Follow-up lengths by kind | inferred | substantive 11 / 16, practical 2 / 3; the two short outliers are the injection refusal (28 w) and the reply to "ok" (15 w), labelled substantive |
| Initial set | 39 / 43, median 549 words, 6 / 39 in 600–750 | 41 / 43 (95 %), median 503 words, 24 / 41 in 500–650; both flagged readings corrected |
| Follow-up spend per published answer | $0.0072 | $0.0057 |
| Initial spend per published reading | $0.0045 | $0.0037 |
| Projection, 100 readings + 300 follow-ups | $2.62 | **$2.06** |

Where the follow-up spend goes now: review 71 %, write 12 %, classify 11 %,
repair 6 %. The classifier's thinking tokens fell from 3,559 to 747 at low
effort. Review input is uncached Gemini tokens; explicit context caching of the
reviewer's system prompt and the frozen reading would be the next lever if the
target has to be met with margin, and is not built.

Still to do from the plan: the remaining 19 faces (on approval of the revised
studies), editorial scoring of the longer prose against RUBRIC.md, new held-out
cases, a real-provider run on a hosted preview, device and Web Vitals checks.
The reserved fresh set has not been run.

## What the checkpoint has to decide

1. **Art direction.** Approve, adjust or redirect the four studies before
   the remaining 19 faces are drawn in the same style. (Superseded by the second pass above; the back is approved, the faces revised.)
2. **Depth.** DeepSeek lands at a median of about 550 words with the 600–750
   target stated twice and the per-card floor stated as "not fewer". Two
   iterations moved the median from 528 to 549. The plan forbids padding and
   paid retries for length, so the honest options are to accept ~550 as the
   reading's depth, to raise the stated ranges knowing the model undershoots
   them, or to revisit the writer. Follow-ups already land in range (12 of 16).
3. **Publication under the longer follow-up.** 18 / 21 against the 90 % gate.
   Two of the three rejections are the boundary stated in the body as well as
   in beyondSpread; the third is the known invented-psychology reply. Longer
   replies restate limits more; the reviewer rule is doing what it was asked.
4. **Cost.** Per published answer this run: $0.0045 initial, $0.0072
   follow-up. Projection for 100 readings plus 300 follow-ups:
   `100 × ($0.0045 + 3 × $0.0072) ≈ $2.62`, above the $2.20 escalation
   threshold. The plan says document the gap rather than shorten or weaken
   review: the increase comes from longer follow-up text through review, three
   withheld turns counted in the numerator, and classification of every turn.
   The earlier v9 gate was about $0.0060 per published follow-up, so the
   follow-up length adds roughly 20 %.
5. **Validator strictness.** `\bprescri` and `\breversed\b` withheld four
   readings across the two JSON-mode runs; both are pre-existing gates and
   were left as they are.

## Not done here

The remaining 19 card faces; a real-provider run of the full reading on a
hosted preview; device checks on iOS Safari and Android Chrome; Core Web
Vitals lab measurement; the editorial scoring of the longer specimens against
RUBRIC.md; new held-out cases. The reserved fresh set has still never run.
