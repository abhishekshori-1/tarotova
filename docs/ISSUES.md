# Known issues

Updated 2026-09-14. Code fixes below are local; production deployment and
end-to-end verification are still outstanding. Accounts and DNS are in
`INFRA.md`; implementation scope is in `IMPLEMENTATION.md`.

## Issue 1: Every interaction is slow

**Status:** Tokyo function region configured in `vercel.json`; awaiting
deployment and new measurements.

Previously recorded production timings:

| Request | Time |
| --- | --- |
| Homepage (`/`, static, no DB) | ~0.09s |
| `POST /api/readings` | ~2.15–2.25s consistently |
| `/reading/[id]/email` client shell | ~0.43s |

Supabase is in Tokyo (`ap-northeast-1`), while the previous investigation
reported US execution (`iad1`). Multiple sequential database queries make
cross-region latency a strong explanation. An `x-vercel-id` can include
edge routing information; verify the function region in Vercel's deployment
or runtime details rather than inferring it from a static response.

**Changes:** `vercel.json` sets `regions: ["hnd1"]`, co-locating functions
with the existing database without migrating data. `createReading` now
uses `INSERT ... RETURNING` to remove its follow-up reading select.
Cold starts still perform the existing migration check.

Vercel supports setting the function region in repository configuration:
[region configuration](https://vercel.com/docs/functions/configuring-functions/region),
[region identifiers](https://vercel.com/docs/regions).

**Verification after deployment:** Confirm the deployed functions use `hnd1`
(also emitted as `region` in the new OTP logs). Measure reading creation
several times, keeping cold and warm requests separate. No new production
latency measurement has been made for these fixes yet.

## Issue 2: OTP emails do not arrive; no Resend records

**Status:** Several reproducible code defects fixed locally. Production's
underlying send failure is not yet confirmed. The user reports an error or
“Too many attempts” on the latest attempt.

A genuine `429 rate_limited` occurs before provider submission, so that
request cannot send an email. Absence of dashboard entries alone does not
prove that every request failed before reaching Resend: check the key's
account, log filters, and actual HTTP result too.

### Confirmed defects and changes

- **Silent production console fallback:** `getEmailProvider` previously
  selected the console provider whenever `EMAIL_PROVIDER` did not exactly
  match `resend`, or the API key was missing. This logged a code and reported
  `accepted` without calling Resend, including in production. Production
  now requires `EMAIL_PROVIDER=resend`, a nonempty `RESEND_API_KEY`, and
  `EMAIL_FROM`. Missing configuration returns `503 email_not_configured`;
  it does not create a challenge or consume send budgets. Values are trimmed.
  Whether production has these bad settings has not been established.
- **Cooldown retries spent send budgets:** A retry inside the 60-second
  cooldown incremented email/IP counters before rejecting the request.
  The cooldown is now checked first. Limits remain 3/hour and 5/day per
  email, 10/hour per IP. They are fixed clock windows, not rolling windows.
  Existing consumed counters remain until their windows expire.
- **Provider failures looked successful:** Resend rejections were returned
  as HTTP 200 and the UI always advanced to “We sent a code.” Definite
  rejection now returns `502 email_send_failed`; uncertain acceptance
  returns 202 and the confirmation screen explains the uncertainty. An
  uncertain code remains verifiable if its email arrives.
- **Broken resend request:** The confirmation screen submitted an empty or
  masked email without a Turnstile token, preventing sending. “Request a
  new code” now opens the email form for the recipient and a fresh bot check,
  retaining the cooldown.
- **Missing diagnostics:** `[otp_request]` logs include request id, region,
  stopping stage, HTTP status, duration and retry interval. `[otp_delivery]`
  logs record submission start/result, provider, challenge id, failure reason
  and accepted message id. These new logs exclude recipients, codes, keys,
  and raw provider responses. The HTTP response includes `X-Request-Id` for
  correlating a browser request.
- **Unbounded Resend fetch / unvalidated acceptance:** The request now has
  a 10-second timeout and explicit User-Agent; only a nonempty provider
  message id counts as accepted. Network failures or malformed success
  responses leave acceptance uncertain. HTTP failures preserve diagnostic
  reasons such as `resend_http_401` and `resend_http_403`.
- **Unhelpful retry message:** The email page uses `Retry-After` to show how
  long to wait and distinguishes expired bot checks from email failures.

Earlier fixes remain: Turnstile's widget render/unmount guard and resetting
its single-use token after a failed submission. The previous investigation
also corrected the deployed public site-key configuration.

### Production verification

1. In Vercel's **Production** environment verify `EMAIL_PROVIDER=resend`,
   `RESEND_API_KEY` is present and belongs to the intended Resend account,
   and `EMAIL_FROM=Tarotova <do-not-reply@mail.tarotova.com>` uses a verified
   domain. Confirm both Turnstile keys. Do not put secrets in logs or source
   control. Environment changes need a new deployment; the public site key
   must be available at build time.
2. Deploy the code, including `vercel.json`, and confirm `hnd1` execution.
3. Wait out the API's `Retry-After` interval before one real OTP attempt.
   Hourly, daily, and IP limits are separate; clearing an email-hour window
   does not clear all other budgets. Do not repeatedly click or raise limits
   to diagnose delivery.
4. Inspect that request in Vercel's runtime logs and match `X-Request-Id`:

   | Outcome | Interpretation / next check |
   | --- | --- |
   | No `[otp_request]` start | Browser request, routing, deployment version, or log filters |
   | 400, stage `turnstile` | Bot token rejected; complete a fresh challenge |
   | 429, stage `request_otp` | App rate limit/cooldown; use `Retry-After` |
   | 503 + `[email_configuration]` | Required email setting absent/invalid; fix and redeploy |
   | `[otp_delivery]` start without finish | Function interruption or request still in flight; inspect platform timeout logs |
   | `resend_http_401` / `403` | Check key validity/permissions and verified sender/domain |
   | `resend_http_429` | Resend rate/quota limit, separate from the app's limits |
   | `pending` | Network/timeout or malformed response; delivery uncertain, check Resend |
   | `accepted` with provider message id | Match that id in the correct Resend account; acceptance is not proof of inbox delivery |
   | 500 | Inspect exception and stage; migration/session/DB work can fail before sending |

5. Confirm receipt and successful code verification. Record the live region,
   warm request timings and accepted Resend message id before marking either
   production issue resolved.

Local verification: 70 Vitest tests pass, including provider configuration,
Resend HTTP failures, uncertain delivery, cooldown budget preservation and
OTP route status codes. Lint and TypeScript checks pass. Local credentials
use the console provider; no live email has been sent by this investigation.
`npm run build -- --webpack` passes. The default Turbopack build is blocked
by this environment's worker-port restriction (including after an approved
retry outside the sandbox); the deployment build configuration is unchanged.

References: [Resend send API](https://resend.com/docs/api-reference/emails/send-email),
[API errors](https://resend.com/docs/api-reference/errors),
[User-Agent guidance](https://resend.com/docs/api-reference/introduction).
