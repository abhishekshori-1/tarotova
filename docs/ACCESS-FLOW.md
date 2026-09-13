# First reading without email; verification when returning

14 September 2026. Proposed UX and access-policy revision for
[PLAN-EXTENDED.md](./PLAN-EXTENDED.md) and [JOURNEY-DESIGN.md](./JOURNEY-DESIGN.md).
The user approved the direction of an ungated first reading and asked how to
introduce email from the second reading. The implementation details below are
recommendations; no application access checks have been changed.

This replaces the earlier planned requirement to verify before every reveal.
The deployed code still uses reading-specific OTP verification and needs an
explicit access-model migration before this experience can ship.

## 1. The proposed rule

**One complete first reading without email. Ask for email verification when an
unverified visitor starts another reading. Remember verification for up to 30
days in that browser, bounded by the browser session's expiry.**

“Another reading” means another distinct card draw. It does not mean reloading
a result, asking a follow-up, advancing a guided journey or resuming that same
reading. The free experience includes the contextual interpretation and the
same proposed three-follow-up allowance, subject to the normal service limits.

| Visitor state | Experience |
| --- | --- |
| New browser session | Question → cards → full result; no email gate |
| Returning to the first reading | Reopen the same result and remaining follow-ups while access is valid |
| Beginning a second draw, still unverified | Brief email/code flow before card selection; preserve the new question or chosen journey |
| Verification succeeds | Resume the intended second reading automatically |
| Beginning later draws with valid session verification | Continue directly; no repeated OTP per reading |
| Session verification expires | Verify again before a new draw; existing unexpired result grants remain readable |
| Gate dismissed, code delayed or delivery fails | First reading remains available; new intent is preserved for retry |

All readings remain free under the present product model. Verification does
not subscribe the person to marketing. This change introduces no journal,
cross-device history or full account-management scope.

## 2. Make the transition feel natural

### Before the first reading

Place a short, low-emphasis disclosure beside the initial action:

> Your first reading needs no email. Confirm your email to continue with more
> free readings.

The first result is complete. Do not cover its final paragraph or close it
when the person declines verification. Keep the natural next actions visible:
ask about this spread, finish the guided journey, or start another reading.
Do not immediately open an email modal on reveal.

### When they choose another reading

Open a focused continuation panel before presenting a new deck. On a large
screen, a small dialog can preserve context; on a phone, use a keyboard-safe
full-page continuation screen. Both share one form and browser Back behavior.

Suggested copy:

> **Keep exploring with Tarotova**
>
> Confirm your email to begin another reading. We'll send a one-time code.
>
> Email address
>
> **Send my code**
>
> This won't subscribe you to marketing.
>
> Return to my reading

Use **Return to journeys** if there is no currently open reading. Do not claim
verification saves a journal or enables cross-device history; neither feature
is in current scope. No password, profile questionnaire or newsletter checkbox
is required to continue.

The next view retains the question/journey summary and shows “Enter the code
sent to [masked email].” Support paste, OTP autofill, a numeric keyboard, change
email, accessible errors and actual server retry intervals. After success,
display a brief confirmed state and continue to the preserved destination.
Avoid a success screen with another mandatory Continue button.

The gate can appear when the person presses Choose my cards for their second
question, or Begin this journey after the free draw has been used. Browsing
journey descriptions remains public. The server rechecks eligibility when the
draw is locked; a stale tab cannot bypass the rule.

## 3. Apply the same rule to guided journeys

The first journey can be the visitor's first reading. All its stages share one
three-card draw and one access grant. Completing its next-step reflection does
not trigger verification. The gate appears only if they begin a second journey
with a new draw, or switch to a new standalone reading after using that draw.

Going from a standalone reading to a guided journey that creates a fresh draw
counts as another reading. Do not silently reinterpret the first draw as a new
journey just to evade or trigger the allowance. Resume links explicitly reopen
the same owned reading/run.

## 4. Define the free allowance on the server

Use the existing random browser-session cookie to look up server-owned state.
Do not trust a localStorage reading count or a client-supplied “first reading”
flag. The practical entitlement is per browser session, not reliably per human.
Cookie clearing, private browsing or another device can create a new session.

At draft creation, check eligibility and return whether continuation verification
is required. An abandoned question or an empty draft does not spend the free
allowance. At the first successful lock/reveal authorization, atomically:

1. Confirm ownership, current revision and exactly three selected slots.
2. Claim the browser session's single guest-reading slot for this reading ID.
3. Freeze the draw/context and create an expiring guest access grant for it.

These operations commit together. Enforce the claim with a unique session key
or conditional update in Postgres, not a read-then-write counter. Repeating the
request for the same reading returns its existing grant. A second simultaneous
reading cannot claim another guest slot.

“First reading used” therefore means an authorized locked draw, not a frontend
result-view event. If the response is lost or contextual generation fails, keep
that same reading recoverable; retry does not consume another allowance. Do not
restore the allowance simply because a browser says it did not see the result.

If two tabs both began before the free allowance was claimed, the losing tab
preserves its question and selected intent and explains that another reading
was opened in this browser. Offer verification to continue; do not silently
discard its draft or expose its cards.

## 5. Separate access from email identity

Today, `readingService.getResult()` requires `readings.state === "verified"`.
A genuine guest result must not be represented as a fake verified email.

Proposed records/fields:

| Area | Responsibility |
| --- | --- |
| Browser session | Existing owner/token/expiry, one claimed guest reading, optional verified email ID and verification expiry |
| Reading lifecycle | Draft versus locked; card/context immutability independent of whether email is verified |
| Reading access grant | Reading ID, owning session, `guest` or `verified_session` basis, creation/expiry; no public URL entitlement |
| Session email challenge | Session ID, purpose, intended email, generation, code HMAC, attempts, send/expiry/consumption state |

All result reads, contextual generations, follow-ups, journey responses and
private server rendering require both ownership and an unexpired reading grant.
Before a grant, only safe draft progress and card backs may be returned.
After guest authorization, the first result is allowed without an email.
Keep private responses uncached and deny a different browser that knows the URL.

Subsequent locks can create their own reading grants when session verification
is valid. A verification expiring later does not revoke an already-issued,
unexpired reading grant. New readings require renewed session verification.
Do not extend either lifetime merely because a client refreshes the page.

Reusing an existing email record does not prove that the current session owns
that mailbox or give it access to readings belonging to another session. The
current session must complete its own OTP challenge.

## 6. Adapt OTP deliberately

The current OTP service requires a locked reading and binds challenges to that
reading. A gate before second-card selection requires a **session continuation**
challenge instead. This is a backend change, not just moving the existing form.

Add session-verification request/confirm endpoints, reusing the email provider,
bot verification, rate limiting and constant-time code comparison. Bind each
digest to the explicit purpose `session_continuation`, session ID, challenge ID,
generation and intended email. Keep these challenges separate from legacy
reading-verification challenges; a code for one purpose cannot satisfy another.

Confirmation must atomically consume the current challenge and record verified
email/expiry on the owning session. Preserve ownership of its existing guest
reading. Renew/rotate the browser token as appropriate without replacing the
owner identity or making existing readings inaccessible. Resume only a validated
same-origin reading/journey destination, never an arbitrary return URL.

Keep the existing send budgets, suppression checks, resend cooldown and truthful
pending/failed delivery states. Authentication failure cannot erase the guest
result. Full accounts, cross-device recovery and marketing enrollment remain
outside this change.

## 7. Abuse, migration and acceptance

An email-free first reading exposes the generation endpoint before the current
email route's Turnstile check. Enforce applicable bot checks and anonymous
generation/session/IP/global budgets on the new guest-grant/generation paths.
A missing production bot configuration must not silently skip a required check.
Challenge suspicious traffic when appropriate, but do not add email as a hidden
requirement for the advertised first reading. If capacity is exhausted, show
an honest unavailable/retry state. IP limits are a backstop, not identity;
shared networks must not automatically be treated as one person.

Roll out with an explicit access-policy version or feature flag. Preserve
unexpired legacy verified readings and their owner checks. Backfill equivalent
grants only from valid existing authorization records. Existing locked drafts
need an explicit policy transition; do not infer email verification from a
client flag or a matching address. Keep a rollback path that can still honor
guest grants already issued while disabling new guest grants if necessary.

Required tests:

- First draw receives exactly one guest grant; two concurrent locks cannot
  receive two guest grants for the same session.
- Abandoned drafts do not spend the allowance; lost responses and retries
  recover the same grant without another generation submission.
- Refresh, same-reading follow-ups and journey step changes never trigger the
  second-reading gate; fresh draws do when session verification is absent.
- Successful continuation OTP resumes the intended draft and permits later
  draws during the verification window without repeated codes.
- Wrong, expired, superseded and wrong-purpose codes cannot verify a session;
  duplicate valid confirmation is idempotent.
- Dismissal, send failure and expired verification preserve independently valid
  reading grants; another browser cannot access them.
- Legacy access and guest access survive the planned deployment/rollback paths;
  every result-bearing endpoint enforces the same entitlement policy.

Measure first-result completion, second-reading intent, gate completion and
delivery failures separately, using metadata rather than question/email text.
The UX hypothesis is that asking after one complete experience makes the reason
to continue clearer; validate that with real usage rather than assuming uplift.
