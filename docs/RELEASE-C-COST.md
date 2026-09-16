# Release C without Sonnet — 16 September 2026

The user requested removal of Sonnet to reduce cost. The local configuration
now uses these explicit roles:

```dotenv
GENERATION_PROVIDER=deepseek,gemini
GENERATION_CLASSIFIER_PROVIDER=gemini
GENERATION_REVIEW_PROVIDER=gemini
GENERATION_REVIEW_MODEL=gemini-3.8-flash
GENERATION_REPAIR_PROVIDER=deepseek
GEMINI_REVIEW_THINKING_LEVEL=low
```

DeepSeek Flash writes and repairs, Gemini Flash triages and reviews, and
Gemini is the fallback writer. No configured role uses Anthropic. The
production writer default is now `gemini,deepseek`, removing implicit
Anthropic fallback while preserving Gemini triage for an unset chain.
Review remains explicitly configured; unset still withholds generation.
Existing explicit environment variables override defaults. Production has
not been changed or redeployed; apply the five settings above to the target
environment before redeploying. Preserve the existing feature flags until
the release gates and editorial pass are complete.

The Anthropic adapter remains available for explicit opt-in configurations
and historical comparisons. No Sonnet API calls were made in this pass.
Neither writer prompts nor reviewer criteria were loosened. The one-repair
limit, fresh review, input triage, shared deadline and validators remain.

## Reviewer experiments

- DeepSeek Flash, existing tool transport: 8/8 initial-reading calibration,
  including the crisis near-miss; 5/8 follow-up calibration, with two malformed
  JSON responses and one invalid review. All five valid verdicts matched.
- A DeepSeek JSON-mode experiment removed malformed JSON in that small run,
  but still had two invalid reviews and one disagreement with a positive
  fixture. It was not retained in the adapter. The positive fixture itself
  deserves editorial adjudication: it names an entrance step and broken lift
  beyond the user's stated access requirements.
- Gemini Flash: first calibration passed 8/8 follow-up cases and matched
  seven reading cases; the remaining reading call returned HTTP 503. The
  repeat passed both sets, 16/16, with the unchanged reviewer criteria.
- Gemini Flash with `GEMINI_REVIEW_THINKING_LEVEL=low`: also passed both
  sets, 16/16. The eight follow-up reviews cost an estimated $0.01330 versus
  $0.02749 at the default effort in the preceding run (51.6% less). Both
  figures include reported thinking tokens; stochastic output still varies.

Reports: [DeepSeek readings](../eval/report/2026-09-16T12-08-39-124Z.md),
[DeepSeek follow-ups](../eval/report/followup-review-2026-09-16T12-09-15-032Z.md),
[DeepSeek JSON-mode experiment](../eval/report/followup-review-2026-09-16T12-12-20-514Z.md),
[Gemini follow-ups](../eval/report/followup-review-2026-09-16T12-11-01-408Z.md).
Confirmation: [Gemini readings](../eval/report/2026-09-16T12-15-28-043Z.md),
[Gemini follow-ups](../eval/report/followup-review-2026-09-16T12-16-10-547Z.md).
Low effort: [readings](../eval/report/2026-09-16T12-20-09-224Z.md),
[follow-ups](../eval/report/followup-review-2026-09-16T12-20-53-798Z.md).

Gemini 3.8 Flash supports low, medium and high thinking levels; its default
is medium. The effort setting is applied only to the dedicated reviewer,
not to the classifier or fallback writer. It is opt-in, not a hardcoded
model default. See [Google thinking levels](https://ai.google.dev/gemini-api/docs/thinking).

## Accounting

Gemini usage now subtracts `cachedContentTokenCount` from total prompt input
and records it as cache reads. Output includes `thoughtsTokenCount` as well
as visible candidate tokens. Earlier Gemini estimates omitted these fields;
do not present those estimates as actual billed savings. See
[Google usage metadata](https://ai.google.dev/api/generate-content#UsageMetadata)
and [pricing](https://ai.google.dev/gemini-api/docs/pricing).

Provider tokenization, cache hits, output lengths and repair rates differ.
Replacing the rate in a Sonnet token table is a projection, not a measurement
of another model. Compare the complete submission cost per eligible turn,
including repairs and retries. Failed calls without reported usage remain
unpriced; provider dashboards are the billing source of truth.

## Haiku and GPT price comparison

Standard text API rates in USD per million tokens, checked 16 September 2026.
Cache reads are separate from cache creation, storage and reasoning output.

| Model | Input | Cache read | Output |
| --- | ---: | ---: | ---: |
| GPT-5 nano | 0.05 | 0.005 | 0.40 |
| GPT-5.6 Luna | 0.20 | 0.02 | 1.20 |
| DeepSeek Flash, peak | 0.30 | 0.006 | 1.20 |
| Gemini 3.8 Flash | 0.75 | 0.075 | 3.75 |
| Claude Haiku 4.5 | 1.00 | 0.10 | 5.00 |
| DeepSeek V4 Pro, peak | 1.32 | 0.044 | 3.96 |

Haiku costs more in every column than either Flash model and the listed GPT
models. It can beat peak DeepSeek Pro for uncached-input-heavy requests:
with no caching, fewer than about 0.308 output tokens per input token makes
Haiku cheaper. Different cache hit rates, tokenization or fewer retries can
also change the total bill. This is not evidence Haiku is a cheaper reviewer
for this app. Haiku cache writes incur an additional rate: 1.25x input for
5m or 2x for 1h. DeepSeek off-peak rates are half its peak rates.

Google currently schedules Gemini 3.8 Flash rates of $1.50 input, $0.15
cache reads and $7.50 output starting 1 January 2027. If that increase takes
effect and Haiku's rates remain unchanged, Haiku would then be cheaper
per token than Gemini 3.8 Flash. The comparison above is for today's rates.

GPT-5 nano has the lowest listed GPT rates here, but its snapshot is marked
deprecated. OpenAI recommends GPT-5.6 Luna for new cost-sensitive workloads.
Neither has been integrated or calibrated as a reviewer in this app.

Sources: [OpenAI nano](https://developers.openai.com/api/docs/models/gpt-5-nano),
[OpenAI Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna),
[DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/),
[Gemini](https://ai.google.dev/gemini-api/docs/pricing),
[Anthropic](https://platform.claude.com/docs/en/about-claude/pricing).

## End-to-end validation

Type-check, lint and all 313 unit tests in 34 files pass on the final changes,
including the opt-in reviewer effort setting. The full unit suite was run
with local server permissions for the provider timeout tests. No browser
suite was rerun in this provider/configuration-only pass.

Default-effort Gemini conversation baseline:
[report](../eval/report/conversations-2026-09-16T12-25-21-025Z.md).
20/21 eligible turns published, all without retry or repair. One initial
reading review timed out, so its conversation was not reached, including
the abuse disclosure. The full gate failed (3/4 tests pass). This is not a
demonstrated routing misclassification, but the missing sensitive case
correctly prevents a green gate. No initial-reading or follow-up answer
was published without review.

Estimated follow-up spend was $0.12291, or $0.00585 per eligible turn.
Initial-reading work cost $0.11011; whole-run known-call cost was $0.23301.
One failed review and failed writer fallback calls can add unreported charges.
The high initial-review thinking usage is why the lower-effort configuration
is being measured separately. Comparing this total to Sonnet without
accounting for the missing conversation would overstate savings.

Low-effort Gemini conversation run:
[report](../eval/report/conversations-2026-09-16T12-31-01-007Z.md).
All four automated tests passed. All 21 eligible turns published on the
first pipeline attempt, 19 without a repair and two after one repair. All
four sensitive turns reached the authored support response. No follow-up
was withheld or skipped. Four stressful-versus-none mismatches remain.
The advisory `no_two_offers` check flagged a negated comparison; the reply
explicitly acknowledged that only one offer remained.

| Known-call estimate | Low-effort Gemini review |
| --- | ---: |
| Follow-up work, 25 submitted / 21 generation-eligible turns | $0.09392 |
| Per generation-eligible follow-up, failures included | $0.00447 (0.447 cents) |
| Initial work, 12 readings | $0.03924 |
| Per initial reading | $0.00327 (0.327 cents) |
| Whole run | $0.13316 |
| Projected initial reading plus three eligible follow-ups | $0.01669 (1.67 cents) |

The projection uses observed averages, including support-classification
overhead allocated over eligible turns. It is not a traffic forecast or
provider bill. Unknown charges from failed fallback calls remain excluded.
The final run used DeepSeek and Gemini only, with no Anthropic calls.

Against the preceding [v4 Sonnet-reviewed run](../eval/report/conversations-2026-09-16T11-28-15-522Z.md),
recorded follow-up spend fell from $0.16403 to $0.09392 (42.7% lower), and
whole-run spend from $0.23041 to $0.13316 (42.2% lower). This is an observed
run comparison, not identical outputs or proof of equal editorial quality.
The new accounting also includes Gemini thinking tokens that the older
report omitted; provider billing remains the definitive comparison.

**Editorial gate remains open.** A targeted read found unsupported wording
that the reviewer approved: the low-mood reply asks "As you sit with the
question alone" without the user having said they reflect alone, and says
the Hermit is how they "close the gap" described by the Moon. The medication
reply introduces a contrast with summoning focus through sheer effort that
the person did not supply. These need adjudication against the rubric;
21/21 publication does not establish equivalent grounding quality. This
configuration is not a production release approval. The reserved fresh set
and transfer-set rerun remain open; no production flags were changed.
