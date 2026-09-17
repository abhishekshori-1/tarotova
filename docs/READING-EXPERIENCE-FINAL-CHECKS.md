# Reading experience: completion checks

**Historical v18 record.** The owner subsequently authorized 85% publication.
Current changes and evidence are in the [85% checkpoint](READING-EXPERIENCE-85-CHECKPOINT.md).

17 September 2026. Working tree on `feat/release-c`. Nothing committed,
pushed, deployed or enabled by this pass. This record supplements the historical
[checkpoint](READING-EXPERIENCE-CHECKPOINT.md).

**Local fixes are implemented. The release is not approved for production.**
The owner removed Gemini's spending cap on 17 September. A minimal request now
returns HTTP 200, and reviewer calibration passes 10/10 initial-reading cases
and 26/26 follow-up cases. The resumed generation runs are complete: initial
publication passes at 39/43, but follow-ups fail at 17/21. Reading length,
editorial findings and the ~$2.83 complete-conversation projection also prevent
approval. No application code, prompt or model setting changed during this
resumed verification; only evaluation records and status documentation changed.

## Changes completed

- All 22 card faces have illustrated compositions. Nineteen sparse symbols were
  replaced, The Star's pose was refined, and the approved back was retained.
  [Complete deck](screens/reading-experience/deck-complete.png),
  [provenance](ART-PROVENANCE.md). These are original assistant-authored SVGs;
  no practitioner certification or new owner art approval is implied.
- Long relevance and synthesis strings render as separate paragraphs. Old
  answers remain readable without synthesis. Paragraph breaks count correctly
  toward the aggregate character limit.
- The reading column adapts to its available width through a container query.
  Position labels and long text wrap at 200% text size. The loading state
  reserves space, reducing the footer shift when the reading arrives.
- Enlarged cards explicitly restore focus to their opener in Safari. Their
  image height adapts to short landscape screens so Close stays visible.
- The follow-up jump still depends on the server reporting an actual composer.
  Three-turn history stays visible when the allowance or feature is off.
- Fixture labels now distinguish an acknowledgment (`ok`) from a pure injection
  redirection. Spanish depth is reported separately from English word ranges.
  No fixture is relabelled based on whether its answer happened to be short.
- DeepSeek uses strict tool schemas on the beta endpoint, with one named field
  for each card position. A deterministic adapter restores the existing ordered
  array. Missing, extra or non-text positions remain invalid. Local length,
  safety, exact-repair and grounding checks remain in force.
- `interpretation.v18` adds depth through distinctions rather than invented
  events. `grounding.v8` / `grounding-followup.v9` explicitly audit declarative
  claims in every field. `repair.v4` preserves useful detail while correcting
  claims. The resumed runs below evaluate these exact changes; the candidate
  is **not accepted**, despite calibration passing.

The strict tool transport follows [DeepSeek's documented schema subset](https://api-docs.deepseek.com/guides/tool_calls/).
Unsupported length/item-count keywords are omitted from the vendor schema;
the existing shared validator enforces them locally. No extra model call,
length retry, padding, truncation, review fallback or Sonnet dependency was added.

## Generation evidence

| Candidate | Evidence | Decision |
| --- | --- | --- |
| Previous second-pass checkpoint, v15 | 41/43 initial readings; 19/21 follow-ups; initial median 503 words; 24/41 in 500–650; ~$2.06 projected per 100 complete conversations | Historical baseline, not proof of this working tree |
| v16 with two paragraphs per card, JSON mode | `2026-09-17T08-52-44-390Z.md`: 24/43 published; missing/reordered card entries | Rejected; the longer format exposed unreliable structure |
| v17 with named positions, JSON mode | `2026-09-17T09-11-48-342Z.md`: 29/43 published; nested/extra fields and other validation failures | Rejected; named keys alone did not constrain the schema |
| v17 conversation run | `conversations-2026-09-17T09-08-34-251Z.md`: 19/21 published, all four automated gates pass | Publication only; does not clear the initial-reading or editorial failures |
| Strict transport diagnostic | Three previously malformed cases pass shape validation: relationship difficulty, layoff, pure injection. `data/review-pass/format-diagnostic.json` | Targeted evidence, not a full quality gate |
| v18 / grounding.v8 calibration | `2026-09-17T10-16-47-584Z.md` and matching follow-up calibration: HTTP 429 instead of reviews | **Blocked by account spending cap; no calibration result** |
| v18 calibration after cap removal | `2026-09-17T11-22-57-791Z.md`: 10/10 initial controls; `followup-review-2026-09-17T11-22-34-057Z.md`: 26/26 follow-up controls | Pass, including the long-change negative and grounded control; not a full generation or editorial gate |
| v18 / strict transport, full initial set | `2026-09-17T11-33-46-643Z.md`: 39/43 published, all seven automated tests pass, 12/12 sensitive routing, repeated initial calibration 10/10 | Automated publication passes; editorial and depth acceptance fail |
| v18 / followup.v11, full conversation set | `conversations-2026-09-17T11-30-52-991Z.md`: 17/21 published, 4/4 sensitive routing, no classification failures or unreached turns | Publication fails; published prose also contains reviewer misses |

The v17 JSON-mode run still lost meaningful content to field nesting. One
captured example placed an extra `challenge-note` inside `cards`. The stricter
transport addresses that mechanical failure without inferring missing text.

## Editorial finding that prevented approval

This is an assistant assessment of the failed v17 candidate, not a completed
human scoring pass. It was sufficient to reject that candidate; the remaining
rows were not assigned invented scores to make a completed report.

| Reading | Relevance / Groundedness / Agency / Tone / Honesty | Finding |
| --- | --- | --- |
| `gen-02`, feeling stuck | 4 / 2 / 3 / 3 / 2 | The opening explains stuckness as the question no longer giving anything new. The person supplied no such cause. Later caveats do not repair it. |
| `gen-04`, making the right choice | 4 / 2 / 3 / 4 / 2 | The World paragraph assumes something has already been completed and asks the person to recognize that achievement. The question supplied no completed event. |
| `gen-05`, everything changing | 3 / 1 / 3 / 2 / 1 | The answer turns change into an asserted shock, says circumstances eventually level out, and calls the experience an illusion of total chaos. This is a dismissive explanation and a forecast. **Blocker.** |

The actual long `gen-05` answer is now a calibration negative, alongside a
grounded control. The resumed calibration catches this specific negative;
the fresh generated variants below show that it does not establish reliable
transfer. Increasing the word count cannot substitute for this.

## Resumed verification after cap removal

The following are single runs of the frozen v18/v11 candidate, using DeepSeek
for writing/repair and Gemini at low effort for classification/review and
writer fallback. Sonnet was not used. The initial set repeats its ten reviewer
controls as part of the run; all ten pass again.

| Measure | Initial set | Conversation gate |
| --- | ---: | ---: |
| Published | 39/43 (90.7%) | 17/21 (81.0%) |
| Published without repair or retry | See per-answer audit | 11/21 |
| Sensitive routing | 12/12 | 4/4 |
| In-range published English initial readings | 16/38 | 3/11 |
| In-range published English substantive follow-ups | — | 10/10 |
| In-range published English practical follow-ups | — | 3/3 |
| Known-call generation cost, including failed/withheld work | $0.20128 | $0.19454 including initial readings |

There are 42 English generation-eligible initial questions: 16/42 both
publish and meet the depth target. Of the 38 published English readings,
19 exceed 650 words and three are below 500; median 650.5, range 467–778.
The raw initial report's aggregate includes the Spanish answer. The English-only figures here
were calculated separately from the displayed word counts, without changing
the report or its gate. The conversation report's 3/12 initial-reading count
also includes its Spanish initial reading: the fixture labels both follow-ups
`es`, but lacks a conversation-level language label. Excluding that initial
answer gives 3/11. Correct that metadata before the next run. Spanish depth
is not approved by an English count.

Follow-up depth also needs its denominator kept visible: ten of the 13
English substantive fixture turns publish in range, and three of four
practical turns do. One acknowledgment and one redirection publish in their
own short ranges. Two Spanish replies publish and are assessed separately.
The reported 10/10 and 3/3 depth figures describe published replies only;
they do not erase the four withheld turns.

### Reliability and rejections

- Initial failures: `work-01`, `growth-03` and `abuse-nearmiss-02` fail shape
  validation; `quality-limits-01` still repeats its boundary after repair.
  The strict endpoint improved availability over the earlier JSON-mode run,
  but did not eliminate schema drift. The validator continues to reject it.
- Three malformed initial DeepSeek replies fall back to Gemini in the initial
  set. The conversation run has four such fallbacks: three initial readings
  and one follow-up. All failed-call usage is present in these cost tables.
- Four withheld follow-ups: `conv-control-disclosure:1` keeps a presumed
  argument dynamic; `conv-changed-facts:2` invents relief and loss;
  `conv-prediction-request:1` repeats an earlier task and invents "tonight";
  `conv-prediction-request:2` keeps the duplicated knowledge boundary.
- The reviewer sometimes finds an issue only on the fresh review, after an
  earlier review left it unflagged. Both published misses and incomplete first
  reviews need attention; calibration success is not a substitute.
- The correction turn's `no_rushing_claim` advisory flags a denial of rushing.
  The Spanish `beyond_spread` advisory is substantive: the forecast reply puts
  the limit in its opening and leaves the boundary field null.

### Editorial rejection of the current candidate

This is an assistant assessment, not the required human or practitioner sign-off.
All 17 published follow-up replies and the four withheld repairs were read.
Initial-reading scoring is partial: it already establishes blockers, so no
complete 39-answer score sheet or ordinary-set mean is claimed.

| Published answer | Relevance / Groundedness / Agency / Tone / Honesty | Finding |
| --- | --- | --- |
| `gen-02` | 4 / 2 / 3 / 3 / 2 | "Feeling stuck is often less about lacking an answer and more about the angle you are looking from" supplies an explanation absent from the question. It passed without repair. |
| `gen-05` | 4 / 2 / 3 / 2 / 2 | "Those two lists are rarely the same length as the feeling suggests" still discounts the stated sense of upheaval. The surrounding reassurance does not establish that the feeling exaggerates anything. It passed after repair. |
| `conv-understanding-only:2` | 4 / 2 / 4 / 4 / 2 | "As a project gathers meaning, that openness narrows, and the shift is real" invents the mechanism the person wanted to understand. A question about whether this causes stopping does not undo the asserted narrowing. |
| `conv-spanish:2` | 4 / 2 / 2 / 3 / 2 | "Un horario, un límite de horas ... Eso no depende de lo que haga la empresa. Depende de ti" treats control over working hours as wholly the reader's, independent of the employer. The reflection also promises that preparing an answer can reassure more than knowing the outcome. |

The understanding-only initial answer also introduces a writing/thinking
exercise after the request to understand without a routine or push. Several
replies repeatedly use "Read together", three-angle constructions, and a
closing boundary even on ordinary reflective questions. These deserve an
editorial pass, but the unsupported explanations above are already release
blockers, not merely matters of taste.

No reserved cases were consumed after this failure: both the original fresh
set and the two full-depth held-out conversations remain unused. No gate,
length range, validator or review requirement was weakened to obtain a pass.

## Local verification

- 362 unit tests in 39 files passed, including strict-schema conversion,
  missing/extra position rejection, internal paragraph length accounting and
  provider deadline tests. Log: `data/review-pass/finish-final-unit.log`.
- Types, lint and production build pass. The build and browsers use isolated
  copies under `.e2e-copy/`; no development database or provider keys are copied.
- Browser coverage includes 320, 390, 768, 820, 1024 and 1440 px, a short phone
  landscape viewport, reduced motion, 200% root text size, long reading/history,
  keyboard focus, composer availability and all three journey flows.
- The cross-engine suite uses WebKit phone/tablet, Chromium Android emulation
  and Firefox desktop. WebKit needs HTTPS for the app's Secure session cookie;
  the test server provides local TLS and forwards the Next development
  WebSocket. Production cookie security was not weakened to make tests pass.
- These are browser-engine and device-emulation checks. Physical iPhone,
  Android keyboard/viewport behavior and assistive-technology testing remain
  separate from this evidence.

Final browser evidence:

| Check | Result | Log |
| --- | --- | --- |
| Complete baseline suite, final UI | 104 passed; 4 flag-off checks deliberately skipped | `data/review-pass/finish-browser.log` |
| Flag-off discovery / robots / no home fetch | 4 passed | `data/review-pass/finish-flag-off.log` |
| Journey flows across WebKit phone/tablet, Android Chrome and Firefox | 24 passed in the cross-engine run | `data/review-pass/finish-devices-final.log` |
| Long-content, focus, text zoom and short-screen checks after the fixes | 28 passed across seven profiles | `data/review-pass/finish-devices-presentation.log` |

The initial cross-engine run also caught three presentation failures; the final
28-case rerun above verifies their corrections. No failed run is represented
as a clean whole-suite run.

Production-build lab measurements, three fresh browser contexts per row:

| Page / profile | Median LCP | Largest CLS | Largest observed interaction |
| --- | ---: | ---: | ---: |
| Home, 390 px throttled phone | 0.928 s | 0 | 96 ms |
| Long reading, 390 px throttled phone | 2.316 s | 0.0178 | 80 ms |
| Home, 1440 px desktop | 0.056 s | 0 | 64 ms |
| Long reading, 1440 px desktop | 0.092 s | 0 | 56 ms |

Phone conditions: 4× CPU slowdown, 1.6 Mbps download, 0.75 Mbps upload and
150 ms network latency, against a local production build. The reading APIs are
layout fixtures. All samples had no horizontal overflow or JavaScript page
errors. The interaction column is a sampled Event Timing maximum, **not field
INP**. These measurements exclude provider and hosted database latency and are
not proof of production Core Web Vitals. Raw data:
`data/review-pass/reading-performance.json`; rerun with
`node scripts/measure-reading-experience.mjs` against a local production server.

The loading-height fix reduced the reading's measured CLS from 0.0996 to
0.0178 on the phone and from 0.0767 to 0 on desktop in these lab runs. No paid
work is involved in rendering or measuring the UI.

Screenshots use an authored layout specimen, not a falsely approved generated
answer: [phone reading](screens/reading-experience/candidate/reading-long-390.png),
[desktop reading](screens/reading-experience/candidate/reading-long-1440.png),
[phone home](screens/reading-experience/candidate/home-long-390.png).

## Cost and external blockers

Gemini previously returned `RESOURCE_EXHAUSTED`: **"Your project has exceeded its monthly
spending cap."** A single minimal probe confirmed the reason. Paid calls then
stopped; no alternate model, account or endpoint was used to evade that cap.
The owner subsequently removed the cap. The availability probe and all 36
reviewer calibration calls succeeded. Calibration cost was an estimated
$0.07545 using the report's existing rate table. This verifies access from the
local evaluation environment; production configuration has not been inspected.

The model configuration remains DeepSeek Flash writing/repairing, Gemini Flash
classifying/reviewing and as writer fallback, all Gemini effort at low in the
evaluated setup. The strict transport adds no pipeline stages.

Using the same published-answer normalization as the previous checkpoint:

- Initial cost: $0.20128 / 39 published = $0.005161 per published reading.
- Follow-up cost: $0.13088 / 17 published = $0.007699 per published reply.
- 100 readings plus 300 published replies: **$2.82575, about $2.83**.
- This is about **37% above** the historical $2.06 projection and **28% above**
  the $2.20 escalation threshold. Reviewer calls are $0.09165, approximately
  70% of follow-up spend. All failed and withheld work remains in the numerator.

These estimates use the existing 16 September rate table, not dashboard bills.
The follow-up mix includes short acknowledgment/redirection turns; it is not
a measurement of 100 completed, three-substantive-turn conversations. A
conversation-run-only calculation gives about $2.84 using its own 12 initial
readings. Neither figure clears the budget or quality gate. Known-call spend
for this resumed calibration and both full runs totals about $0.49, excluding
the minimal availability probe. All report calls have usage and known pricing.

No immutable preview URL containing this working tree has been supplied. Local
build measurements exclude Vercel/Supabase distance, real generation, hosted
database behavior and production traffic.

## Remaining release sequence

1. **Done:** owner restored Gemini availability; all 10 initial-review fixtures
   and 26 follow-up reviewer controls pass. The earlier quota failures remain
   recorded separately from judgement results.
2. **Run, not accepted:** initial automated checks pass, conversation publication
   fails, and the current prose has material reviewer misses. Diagnose the
   writer/repair behavior and review misses using the captured traces before
   another paid run. Shorten overlong initial sections without padding,
   truncating or introducing length retries. Repeat calibration and generation
   on any changed candidate, then complete editorial scoring, including every
   stressful answer. Retain the 90% publication and depth acceptance criteria.
3. Once the candidate is frozen, run `npm run eval:conversations:fresh` and
   `npm run eval:conversations:depth`. Neither has run in this pass. The new
   depth set contains two actual three-follow-up conversations so the cost
   estimate can be checked against completed conversations, not just a mixture
   of short and long turns. Consumed cases become regression evidence if the
   prompt changes again.
4. Bring the measured ~$2.83 projection within the ~$2 target / $2.20
   escalation threshold, including failed calls, repairs and withheld work;
   the lower historical estimate does not apply to this candidate.
5. Verify an immutable preview containing the final changes with real providers,
   migration 0006, a complete conversation and journey, and physical phone
   checks. Commit/merge/deploy only on the owner's instruction.
