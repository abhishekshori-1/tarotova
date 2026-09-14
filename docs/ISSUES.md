# Known issues

Updated 2026-09-14. **Both issues below are resolved and verified in
production** (GitHub issues #1 and #2). The sections are kept as the record
of what was found and how it was fixed. Accounts and DNS are in `INFRA.md`;
implementation scope is in `IMPLEMENTATION.md`; the v2 rollback procedure is
in `VERSIONING.md`.

| # | Issue | Resolution | Verified |
| --- | --- | --- | --- |
| 1 | Every interaction slow (~2.2 s) | Functions pinned to `hnd1` (Tokyo) next to Supabase; one redundant query removed | `x-vercel-id: …::hnd1::…`; `POST /api/readings` ~0.3–0.4 s warm, lock ~0.4 s, result ~0.3 s |
| 2 | OTP emails never arrive, no Resend records | Resend domain verification had never been started, then the `RESEND_API_KEY` row held an empty value; both fixed operationally. Code now fails visibly instead of silently | Real code delivered and confirmed in production on 2026-09-14 |

## Issue 1: Every interaction is slow — RESOLVED

**Status:** Resolved 2026-09-14. Deployed with commit `d4d4ad1`; region and
timings verified live (table above).

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

**Verification (done):** `x-vercel-id` on API responses shows `bom1::hnd1::…`
(Mumbai edge, Tokyo function). Measured from India after deployment:
`POST /api/readings` 0.29–0.39 s warm (1.2 s on the cold start that also ran
migrations), lock 0.37–0.43 s, result 0.27–0.39 s — down from ~2.2 s.

## Issue 2: OTP emails do not arrive; no Resend records — RESOLVED

**Status:** Resolved 2026-09-14. Two operational causes, found in order:

1. The `mail.tarotova.com` domain had never been submitted for verification
   in Resend (dashboard status "Not Started"). Clicking Verify moved it to
   Pending and then Verified.
2. The `RESEND_API_KEY` variable existed in Vercel but its stored value was
   empty, so production logged `[email_configuration] RESEND_API_KEY is
   required for Resend.` Deleting the row and re-adding the key (type
   Secret, Production) and redeploying fixed it.

After both, a real code was delivered and confirmed in production. The v2
session-verification flow (deployed later the same day) uses the same
provider path and still needs one real production send to be called
verified end to end.

The original diagnosis follows. Root cause found and confirmed on 2026-09-14: the `mail.tarotova.com`
sending domain's status in the Resend dashboard was **"Not Started"** —
verification had never been submitted, despite the DKIM/SPF/MX/DMARC records
being correctly configured and resolving (re-confirmed independently via
`dig @1.1.1.1` at the time this was found). An unverified domain rejects
sends silently at Resend's end; a request never gets far enough to leave any
dashboard or log trail, which matches exactly what was observed (no email,
no Resend records, no obvious error). The DNS-resolves check done during
initial setup was necessary but not sufficient — it never confirmed Resend's
own dashboard had actually flipped the domain to verified.

Verification was manually triggered from the Resend dashboard; status moved
to **"Pending"** (Resend's own message: "Looking for DNS records: this may
take a few hours depending on Cloudflare's propagation time"). Awaiting
"Verified" before a real send test.

Separately, a genuine `429 rate_limited` occurs before provider submission,
so that request cannot send an email. Absence of dashboard entries alone
does not prove that every request failed before reaching Resend: check the
key's account, log filters, and actual HTTP result too.

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
