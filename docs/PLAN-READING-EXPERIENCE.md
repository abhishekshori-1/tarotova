# Tarotova: a richer reading and a visible UI redesign

17 September 2026 · **Local completion pass in progress; see [READING-EXPERIENCE-CHECKPOINT.md](READING-EXPERIENCE-CHECKPOINT.md) for evidence and remaining release gates.**

The owner accepted **500–650 words** for the initial reading in the second pass, subject to editorial scoring. On 17 September the owner lowered the **publication rate to 85%** for initial readings and follow-ups. Grounding, safety routing, depth-adherence and cost requirements are unchanged. `eval/thresholds.ts` is the shared publication threshold.

The later acceptance of **80% for the fresh conversation set only** clears its
4/5 availability result. Initial readings, the main conversation gate and other
sets retain 85%; safety routing, review and cost thresholds are unchanged.

Later on 17 September, after the candidate's editorial findings and length
variation were reported, the owner approved the newly generated answers.
That candidate-specific acceptance and the remaining technical gates are
recorded in [the 85% checkpoint](READING-EXPERIENCE-85-CHECKPOINT.md). It is not
a claim that the numerical editorial/depth criteria below were met; targets
and reviewer controls remain for monitoring and future changes.

The next release should deliver two immediately noticeable changes: a reading
with enough substance to spend time with, and an interface that makes choosing,
reading and discussing the cards feel like one considered experience.

This is the implementation brief for those changes. It makes the visual direction
in [PLAN-EXTENDED.md](PLAN-EXTENDED.md) concrete and brings the question companion
and guided journeys into the same design. The existing access, ownership and
one-draw rules remain the foundation.

## 1. What needs to change

The current implementation explains why the experience still feels small:

| Evidence in the working tree | Consequence |
| --- | --- |
| The home-page card composition is hidden below the large-screen breakpoint | Most phone visitors see a form without the strongest visual element |
| The reading uses small spread thumbnails, then repeats the art beside three similar sections | There is little visual progression or emphasis |
| The follow-up form sits after the entire reading | The companion is easy to miss, especially on a phone |
| Initial card paragraphs have a 600-character ceiling; the opening has 900 | A more developed reading needs changes beyond its prompt |
| Follow-ups permit at most three paragraphs and 1,800 characters in total | The conversation is designed around short replies |
| Repair replacements have a separate 900-character ceiling | Increasing writer limits alone would break some repairs |

Measured from the complete answer JSON in the latest
[gate transcript](../eval/report/conversations-2026-09-16T21-02-11-409Z.md):
12 initial answers contain **274–403 words, median 361**; 20 published follow-ups
contain **37–292 words, median 167**. The follow-up sample includes brief
acknowledgments. These counts exclude headings and optional library expansions.
They describe local evaluated output, not a measurement of the deployed site.

The current prompts are `interpretation.v13` and `followup.v9`. Work should start
from these versions, rather than apply the earlier v8 suggestions a second time.
Existing automatic passes do not establish approval of the longer voice.

## 2. Reading depth: the proposed standard

### Length and structure

| Experience | Proposed English editorial target | What earns the extra space |
| --- | --- | --- |
| Initial reading with a question | **500–650 words** | An opening perspective, three developed card interpretations, a synthesis, one reflection |
| General reading without a question | **500–650 words of authored content** | Richer card explanations and position/focus context, without inventing a situation |
| Substantive follow-up | **220–320 words** | A direct answer, a developed distinction or possibility, and its relevance to this conversation |
| Practical request | Usually **180–280 words** | Usable words or one feasible option, with enough explanation to adapt it |
| Prayer, thanks or goodbye | **One or two sentences** | A warm acknowledgment appropriate to the moment |

The targets cover the complete answer, including reflection and any necessary
boundary. They are editorial targets, not instructions to pad every message.
An understanding-only question gets depth without being turned into a task.
Support responses retain their authored format and bypass these length targets.
Other languages need equivalent depth assessed in that language, rather than an
English whitespace word-count requirement.

The full initial reading has this structure:

| Section | Target | Editorial purpose |
| --- | ---: | --- |
| Opening perspective | 80–95 words | Offer a specific way into the actual question; give the reader something useful immediately |
| Situation | 110–125 words | Explain this card's theme and explore its relevance without assigning facts to the person |
| Challenge | 110–125 words | Examine a distinct tension or consideration; respect constraints already stated |
| Guidance | 110–125 words | Develop an available perspective, or an optional approach when practical help was requested |
| How the cards connect | 75–90 words | Bring the three contributions together; add a distinction rather than recap each paragraph |
| One reflection | 20–30 words | Leave one worthwhile question, or an appropriate optional action |
| Knowledge boundary, if needed | Usually one sentence | State only the specific uncertainty the question requires |

Aim near the middle of these ranges to reach 500–650 words. Section ranges are
guidance; their individual minimums are not separate publication gates.

### How longer answers stay worth reading

Every added paragraph must explain a card connection, distinguish possibilities,
or develop an example clearly offered as a possibility. It cannot manufacture a
cause, feeling, relationship fact, resource or future event to fill space.

Hope comes from a real opening: something still undecided, something the person
can express, another way to understand the question, or an option consistent with
their stated limits. It must not become a compulsory upbeat ending. Difficult
cards deserve humane treatment without claiming that disruption is beneficial.

Use a single brief boundary when needed, presented after the useful answer in
ordinary text. Avoid repeated “three cards cannot answer” sentences. Boundaries
still govern every claim, even when the boundary field is null. A professional
referral cannot serve as a replacement knowledge boundary.

Follow-ups should move the conversation forward. They need not mention all three
cards or repeat the initial answer. Suggested questions remain authored and
contextual to the focus/journey; tapping one fills the composer for confirmation.

### General readings deserve substance too

Keep general readings free of a generation call. Add a reusable, longer authored
exploration for each of the 22 cards, then combine it with the existing frozen
position and focus text. Target 500–650 words across the displayed reading.
Move core meanings into their card sections so the overview does not repeat them.

This is a bounded editorial addition to the library. Existing locked readings
retain their original copy; new content gets a new content version. Added card
material follows the existing editorial review process and does not establish
that the separate practitioner review has happened.

## 3. The visual experience

### A stronger expression of the existing direction

Keep the midnight/plum, parchment, restrained gold, Fraunces and Inter foundation.
Change composition, art, scale and interaction sufficiently that the redesign is
obvious in side-by-side screenshots. The first phone viewport must have a clear
visual identity as well as a useful action.

Commission or create one coherent set of richer symbolic card illustrations.
Begin with a card back and three studies: The Fool, The Star and The Tower. Use
those to settle detail, light, framing and the handling of difficult imagery,
then extend the approved style across all 22 faces. The existing sparse SVG
symbols are the baseline to improve. Art must agree with the library; generated
writing may only refer to symbolism supplied in its approved context.

This is a one-time asset investment, accounted separately from model usage per
reading. Deliver responsive optimized assets with fixed aspect ratios. Load the
card backs needed for selection and the three authorized faces for a reading;
do not preload the entire face deck. Keep essential names/positions as real text.

### Screen-by-screen changes

| Screen | Proposed visible result |
| --- | --- |
| Home | A prominent three-card composition on phones and desktop, a spacious question composer, clear general-reading alternative, and three illustrated journey invitations when available |
| Choose | A tactile card table, legible three-position tray and obvious selection feedback; touch, keyboard and click all work without requiring drag gestures |
| Reveal | A large, intentional spread with position labels; one brief reveal transition, followed by the opening of the reading |
| Read | An editorial page with a clear opening, substantial card sections, a combined interpretation and a closing reflection; long prose sits on a calm, high-contrast surface |
| Continue | A visible “Ask about this reading” entry near the opening, plus a conversation section directly after the reading; a single composer with suggested questions and clear remaining turns |
| Journey | Distinct Frame, Explore, Reflect and Complete compositions, with a persistent sense of progress and the same reading/conversation components |

The top spread becomes a useful visual index. Selecting a card moves to its
section without drawing again. On desktop, a sticky spread rail keeps the cards
and question in view beside a 55–70-character text column. On mobile, the spread
starts full-width; section links and an unobtrusive “Ask about this reading”
control make a longer page navigable. A card can open an accessible enlarged view.

Display the complete main reading by default. Optional “About this card” library
material can remain collapsible. Avoid making the reader open several accordions
to receive the answer they came for. Additional artwork in card sections should
serve a deliberate composition, rather than repeat identical thumbnail rows.

```text
PHONE                                DESKTOP / WIDE TABLET
┌───────────────────────────────┐    ┌──────────────────────────────────────────┐
│ Tarotova       Journey stage  │    │ Tarotova                   Journey stage │
│ Your question                 │    ├──────────────┬───────────────────────────┤
│                               │    │ Question     │ Opening perspective       │
│   [CARD]  [CARD]  [CARD]       │    │              │                           │
│ Situation Challenge Guidance │    │ Three-card   │ Situation · card + prose  │
│                               │    │ spread       │                           │
│ Opening perspective           │    │              │ Challenge · card + prose  │
│ Ask about this reading ↓      │    │ Section      │                           │
│                               │    │ links        │ Guidance · card + prose   │
│ Situation · developed reading │    │              │                           │
│ Challenge · developed reading │    │ Ask about    │ How the cards connect     │
│ Guidance · developed reading  │    │ this reading │ One reflection            │
│ How the cards connect         │    │              │                           │
│ One reflection                │    │              │ Conversation + composer   │
│                               │    └──────────────┴───────────────────────────┘
│ Explore this reading          │
│ [suggestion] [suggestion]      │    Structural sketch; the design deliverable
│ Your follow-up…         Send  │    must demonstrate actual art, type and copy.
└───────────────────────────────┘
```

The near-opening action jumps to and focuses the existing composer. It must not
create a second form, submit automatically, or cover the reading when the keyboard
opens. Follow-up availability comes from the server. Unavailable, exhausted and
closed states explain what is possible and keep existing conversation readable.

### Journeys and continuation

Give the three selected journeys their own motif and introductory composition:
Navigating a change, Preparing for a conversation, Reopening creativity. Preserve
the approved template direction. Completion can show the already saved question,
cards and reflection as a keepsake-style layout, using existing content only.

First reading remains available without email. Verification before a subsequent
draw uses the same visual language and preserves the question and destination.
Closing a journey never requires another draw, a follow-up, or a reflection
submission. Journey transitions and completion make no model calls.

### Motion, waiting and accessibility

Use short 150–300 ms feedback transitions and a reveal sequence under one second,
without adding a mandatory delay to ready content. Reduced-motion mode shows
equivalent state changes without movement. Avoid typewriter text, autoplay video,
scroll hijacking and particle effects over reading text.

Before triage, show the saved question and a truthful progress state. After safe
triage, cards and authored meanings may appear while the answer is prepared.
Display generated prose only after review approves it; do not stream unreviewed
drafts. Preserve the reader's scroll/focus position when approved text replaces
loading content. A failed answer keeps the safely available library reading and
the existing bounded retry. Support routing replaces advice with support content.

Reading body text starts at 18 px with roughly 1.65–1.8 line height. Controls have
at least 44 px targets. Check contrast, visible keyboard focus, screen-reader
headings/live announcements, 200% zoom, safe areas and open keyboards. At narrow
widths the page scrolls vertically without horizontal overflow.

## 4. Coordinated implementation for longer content

These are proposed starting limits for an evaluated candidate, not a promise
that increasing ceilings alone will produce good prose.

| Area | Planned change |
| --- | --- |
| Reading output | Add a required `synthesis` field for new answers; keep the existing opening, three ordered cards, reflection and optional boundary |
| Reading validation | Opening up to 1,200 characters; each card up to 1,800; synthesis up to 1,200; reflection 320; boundary 480; aggregate text ceiling 7,200 |
| Follow-up output | Permit up to five paragraphs, each up to 1,100 characters, with an aggregate ceiling of 3,400 including optional fields; preserve short acknowledgment support |
| Repair contract | Validate replacement length against the specific destination field, replacing the universal 900-character cap; add synthesis and paragraph 4/5 to field mapping and exact-edit checks |
| Tool schemas | Update writer, reviewer and repair schemas together, including the maximum of seven editable fields and per-call narrowed repair schemas |
| Provider output budgets | Start DeepSeek at 2,400 tokens for initial writing/repair and 1,600/1,800 for follow-up writing/repair; verify multilingual and worst-case repairs fit; audit Gemini fallback limits and thinking usage separately |
| Versioning | Introduce a versioned answer shape and new prompt versions; normalize old answers for display with no synthesis; never regenerate old stored answers just to fit the UI |
| Reporting | Show section lengths, whole-answer lengths, synthesis quality, repetition, all-attempt costs and phase timings |

New synthesis text receives the same whole-answer review as every other field.
One writer call produces all sections. One review covers them together. Expanding
a card, navigating a section or reopening a reading never calls a model.

Use shared length constants for schemas, validation and prompt/repair instructions
so their limits cannot quietly diverge. English length adherence is reported in
eval and judged with quality; do not add a paid retry solely to reach a word quota
or truncate text into compliance. Existing structural and grounding gates remain.

The implementation touches `prompts.ts`, `validate.ts`, `types.ts`,
`grounding-prompts.ts`, `reviewed.ts`, provider adapters, stored-answer readers,
API views, rendering and eval fixtures together. Existing JSON storage may avoid
a database migration, but confirm every persistence and deserialization path
before deciding that. Test old readings and old follow-up histories explicitly.

Keep the shared 55-second provider deadline and existing attempt policy. Larger
outputs must fit inside that budget; raising it or adding repair loops is not the
proposed solution. Use the existing reviewed path and provider configuration:
DeepSeek writer/repairer, Gemini classifier/reviewer, Gemini writer fallback.
Sonnet has no role in this plan.

## 5. Cost: target $2 for 100 complete conversations

Define this consistently as **100 initial readings plus 300 substantive
follow-ups**. Model costs include classifier, writer, reviewer, repair, retry,
fallback and reported thinking/cache usage. Hosting, database, email and one-time
design/art production are separate costs.

The target budget is approximately $0.005 per initial reading and $0.005 per
follow-up: `100 × ($0.005 + 3 × $0.005) = $2.00`.

There is already pressure on that budget. The latest gate run spent $0.11978 on
follow-ups and published 20, approximately $0.006 per published answer. Scaling
that alone to 300 published follow-ups gives about **$1.80 before initial readings**.
That is a planning extrapolation from a small run, not a completed-conversation
bill. The older roughly $1.58 estimate is not a guaranteed baseline for this work.

Longer writing is relatively inexpensive, but its text also travels through
review and subsequent context. For scale only, using the rates already recorded
in [eval/cost.ts](../eval/cost.ts), an extra 1,000 DeepSeek output tokens plus
1,000 uncached Gemini review-input tokens costs $0.00195, or $0.195 across 100
conversations. This illustration excludes history reuse, thinking, repairs and
fallbacks. Prices have not been independently rechecked for this plan.

The cost work should therefore accompany the length change:

1. Keep prompts concise and stable-prefix friendly. Add the length/structure
   contract without accumulating another long list of repeated prose rules.
2. Avoid duplicate context serialization. Retain the full question, frozen card
   meanings, initial answer and relevant conversation; do not add a paid summary
   stage or discard earlier disclosures to make the request cheaper.
3. Keep review output concise while preserving usable exact quotes and reasons.
   Any wording change needs the existing positive/negative calibration.
4. Use complete failure traces to reduce preventable DeepSeek fallback and
   malformed-output repairs. Never count an unpriced failed call as free.
5. Keep cached/static general readings, journey stages, artwork, navigation and
   suggestion selection at zero incremental model cost. Do not skip reviews or
   weaken the quality gate to meet the budget.

Measure a baseline and candidate with identical models, effort settings, fixture
sets and accounting. Report cold and warm cache scenarios, cost per eligible and
published answer, completion rate, and a 100-complete-conversation projection.
Do not treat a run with missing answers as cheaper completed conversations.

**Cost gate:** demonstrate approximately $2 per 100 complete conversations with
the new depth. If the observed projection exceeds $2.20, document the gap and
the measured trade-off for review. Do not silently shorten the reading, remove
review, or claim the target has been met. The extra 10% is an escalation threshold,
not a revised spending commitment.

## 6. Delivery sequence and acceptance

| Step | Concrete deliverable | What the review establishes |
| --- | --- | --- |
| 1. Establish the baseline | Phone/desktop screenshots of the actual current build and representative full readings; record branch/build, flags and measured lengths | We are comparing the intended environment and content |
| 2. Design the experience | High-fidelity home, draw, reading/conversation and journey screens at 390 px and 1440 px; tablet adaptation; three face studies and card back | The visible change is substantial and works with real-length text |
| 3. Prove the content | Two complete 500–650-word specimens, one difficult and one everyday question; a general reading; substantive, practical and acknowledgment follow-ups | Added length supplies insight and remains warm, grounded and readable |
| 4. Build both together | Responsive UI, approved art set, versioned longer output, shared constraints, backward-compatible rendering | The production path can deliver the exact experience reviewed |
| 5. Validate quality and cost | Existing gates/calibration, a bounded confirming run, then new held-out cases and editorial scoring | Longer content meets quality, availability, latency and cost targets |
| 6. Verify the preview | Immutable preview URL, screenshots from that build, complete question conversation and full journey, flags and migration checks | The reviewed design is actually what the user sees |

Design review should include a complete reading on the page, not placeholder
paragraphs. Template copy already approved in the conversation is the starting
point; artwork and layout approval are separate from generated voice approval.
The first design checkpoint resolves direction before extending art across 22
cards, rather than requiring approval for each routine implementation detail.

Acceptance requires:

- The redesign is obvious on home, reveal and reading screens at both phone and
  desktop widths. Card art, hierarchy and continuation affordances visibly change.
- At least 90% of eligible substantive English eval answers land in their proposed
  depth ranges; exceptions are explained. No padding to obtain a passing count.
- Every paragraph contributes something distinct. Score whole displayed answers
  against [RUBRIC.md](../eval/RUBRIC.md): mean at least 4 on every dimension, no
  Agency or Honesty score below 3, and no unsupported prediction, relationship
  verdict or dismissive explanation of distress. Read every stressful answer.
- Check repeated openers, images, caveats and example echoes across complete
  conversations as well as individual answers. Calibration success alone does
  not clear a known editorial failure.
- Require at least 85% publication and retain the existing safety-routing gates; report retries, repairs,
  withheld and unreached turns separately. Use new held-out scenarios after the
  candidate is fixed; previously run “unseen” cases are regression cases now.
- Verify 320, 390, 768, 1024 and 1440 px layouts, short landscape screens and
  keyboard-open forms, plus an iOS Safari and Android Chrome device check. Test
  reduced motion, keyboard navigation, zoom and screen-reader flow.
- Target approved-answer p95 at or below 20 seconds in the agreed test conditions;
  record fallback/repair cases separately. The hard request deadline remains.
  Progressive library display must never bypass triage to make timing look better.
- Target LCP at or below 2.5 seconds, CLS at or below 0.1 and INP at or below
  200 ms under documented measurement conditions. Record lab evidence separately
  from field data; identify any added asset or script causing regression.
- Recheck duplicate submission, refresh/back, ownership, expired access, retry,
  budget rejection, feature-off history and support closure after UI integration.
- Record cost and completeness alongside quality. Verify the deployed preview's
  build and flags before diagnosing an unchanged screen as a design failure.

This proposal is one combined UI/content release with explicit design and eval
checkpoints. It does not include native apps, a 78-card expansion, voice output,
accounts or additional paid conversation stages. No application code, prompts,
flags or deployment settings are changed by this document.
