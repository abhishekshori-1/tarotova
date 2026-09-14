# Release B — the reading on your question

The product owner's view of Release B: what a reader gets that they did not
get in Release A, what the language model does and does not do, what it
costs, what protects it, and what has to be true before it goes live.
Engineering detail is in `IMPLEMENTATION.md`; environment and accounts in
`INFRA.md`; the release gate in `../eval/RUBRIC.md`. Written 14 September
2026 on `feat/release-b`, before merge.

## What a reading was in Release A

Every word came from a fixed library. Each of the 22 cards has hand-written
text for each of the three positions (Situation, Challenge, Guidance) and a
note per focus (general, relationships, work, growth). The paragraph at the
top is a template that drops in the three card names and meanings. The
closing question is one of twelve, picked deterministically per reading.

A typed question was stored and shown back as the heading. That was all it
did. Two people with the same three cards got the same reading, whatever
they asked.

## What Release B adds

One section, "On your question": the three cards are read against the words
the person typed. It appears a few seconds after the library reading, as a
paragraph under the heading and one paragraph beside each card, plus one
concrete thing to try.

Everything else is unchanged: the shuffle, the 22 cards, the library text,
who may see a reading, the email rule. Two consequences:

- No question, nothing new. A reading without a question is exactly
  Release A.
- Flag off, nothing new for anyone. `GENERATION_ENABLED` is off by default
  and stays off in production until the gate below passes.

One thing did change for readings without a question too: the email-free
first reading now carries a bot check before the cards turn over (the same
check the email form already had). A verified browser never sees it.

## What the model does, exactly

Two calls to the Anthropic API, only when a reading has a question and the
cards are turned over.

1. **Triage.** A small model reads the question and answers one thing: is
   this an ordinary question, or one a card reading should not answer? The
   categories that stop the reading are a crisis (wanting to die or to be
   hurt), a request for medical instruction, a request for legal
   instruction, and someone being harmed or wanting to harm someone. Those
   get a written note with resources instead of a reading. "Feeling low
   since winter" is ordinary; "should I stop my antidepressants" is not.
   The distinction is by intent, not by words.
2. **The reading.** A larger model receives the question, the focus, and the
   library text for the three cards drawn. It writes four things: a short
   take on the three together, one paragraph per card about what it says to
   this question, one thing to try, and, only when the question asks for
   something three cards cannot give (a date, a yes or no, another person's
   mind), a gentle line saying so and where that answer does live.

It sees nothing else: not the email address, not the session, not other
readings. It does not shuffle, does not choose cards, does not decide who
may see a reading.

What the server refuses to show, whatever the model wrote: a card that was
not drawn, the word "reversed", a prediction or a promise ("is guaranteed",
"this reading predicts"), medical or legal instruction, text of the wrong
shape or length. A rejected answer is thrown away and the model is asked
once more; two failures and the reading stands without the section.

The answer is stored once per reading. Refreshing, reopening or coming back
a week later shows the same words and costs nothing.

## The voice

The prompt describes a reader who has done this a long time: plain words,
short sentences, second person, warm before witty, never a command, never a
quip at the reader's expense, no therapy-speak, no fortune-cookie lines.
When the cards cannot answer part of a question, it is said the way you
would say it to a friend across the table, then followed by what the cards
can offer. Prompt versions are recorded on every stored answer:

| Version | What it sounded like |
| --- | --- |
| `interpretation.v1` | A careful assistant. Correct, grounded, forgettable |
| `interpretation.v2` | The reader, but curt: "cards don't do calendars", "stop leaving it vague" |
| `interpretation.v3` | The reader, warmth first. Current |

The interface uses the same voice: Ask, Pull, Read; "Pull my cards", "Just
read for me", "Turn them over", "The short of it", "On your question", "Try
this", "One to take with you", "Pull again".

Nothing in the app names an AI or a vendor. The privacy page says a typed
question is processed by a third-party service provider on our behalf,
which is the one line a privacy policy has to carry.

## What it costs and what protects it

Per reading with a question: one small triage call and one answer call of
roughly 2,000 tokens in and 700 out, about ten seconds. Paid from prepaid
credits with auto-reload off, which is the hard spend cap.

Protections, all server-side:

- The bot check on the email-free reading.
- Daily caps: 10 readings per browser, 30 per IP address, 400 overall
  (defaults; environment-adjustable). When a cap is hit the reader sees a
  quiet "come back in a bit" line and the library reading stands.
- Two paid attempts per reading, ever, recorded before the call is made so
  a crash can never cause a runaway retry.
- Two switches: `GENERATION_ENABLED` turns the whole feature off;
  `GUEST_GENERATION_ENABLED=false` pauses it only for email-free readings
  while verified readers keep it.
- Production never falls back to a fake answer: with no key configured the
  section simply reports itself unavailable.

Retention: the answer is deleted with its reading, 30 days after access
began.

## What has to be true before it goes live

1. `npm run eval` runs 49 fixed questions (all four focuses, ambiguous,
   long, prompt-injection, and near-miss pairs such as "should I stop my
   medication" against "how do I approach the appointment") through the
   real model. The automated part passes when crisis and abuse route
   correctly every time, medical and legal at least nine times in ten, no
   ordinary question is refused, and at least nine answers in ten pass the
   server's checks first time. Status: routing has passed on every run;
   the answer check passed once the validator stopped rejecting honest
   denials ("nothing is guaranteed").
2. A person reads the report and scores each answer on relevance,
   groundedness, agency, tone and honesty (`../eval/RUBRIC.md`). Mean of 4
   or better on each, nothing below 3 on agency or honesty, every
   emotionally heavy answer read by a person. Status: not yet done; the
   voice is being tuned first.
3. `TURNSTILE_SECRET_KEY` present in production (it is), `ANTHROPIC_API_KEY`
   and, for an organization-level key, `ANTHROPIC_WORKSPACE_ID` set, then
   `GENERATION_ENABLED=true` and a redeploy. Merge order in
   `VERSIONING.md`.

## What Release B is not

No follow-up questions, no guided journeys (Release C). No memory across
readings. No change to the 22-card library text, which is still draft copy
awaiting a practitioner's review; if the reader's voice is right, the
library text is the next thing to bring in line with it.
