# Security review: Supabase schema (D64, gate 0) — 2026-11-20

Scope: `supabase/migrations/20261120000{100,200,300,400}_*.sql`, `supabase/tests/database/rls_quota_sessions.test.sql`, and the existing shared access-code path (`api/_lib/access.ts`, `api/unlock.ts`, `api/lock.ts`, `api/_lib/http.ts`). Static review by a separate reviewer pass. Nothing was run: the pgTAP file is **written, not run**.

No isolation break was found: anon, owner, other user and service role reach only what they should.

## Fixed in the migrations

| Sev | Finding | Fix |
| --- | --- | --- |
| HIGH | Cancelling (or a lost worker) after a paid provider call refunded the credit, so a user could get paid AI/search work free by cancelling at the right moment. | The database decides the charge: any attempt recorded as sent (`dispatching`/`accepted`/`succeeded`/`unknown`) uses the credit, whatever the final status. Worker no longer passes a spend number. A cancel also blocks new paid calls (`begin_attempt` refuses). Tests for both cases. |
| MED | Users could delete finished jobs, which cascaded away the paid-call records and let the global daily cap be bypassed. | Users can no longer delete jobs (retention removes them after 30 days). Daily cap counts `reserve` ledger rows, which outlive jobs. |
| MED | A job that crashed the worker before any paid call was redelivered forever, holding a slot and a credit. | After 5 deliveries it fails and the credit is returned. |
| MED | A worker crash after a successful paid call re-ran the job and paid again. | `succeeded` attempts count as in flight: the job ends as `unknown` instead of re-running (recorded as a shortcut; resume-from-saved-output is the upgrade). |
| MED | pgmq/pg_net tables and functions may be granted to API roles on some Supabase versions; pg_net's queue briefly holds the worker secret header. | Explicit revokes plus pgTAP assertions over every `pgmq`, `net`, `bff`, `app_private` function and table. |
| MED | `submit`/`cancel`/`quota` were callable by any signed-in user's JWT, skipping backend validation and rate limits. | Moved to schema `bff`, service role only; the backend passes the verified user id. Signed-in users keep read-only access to their own jobs and RLS-guarded cards. |
| LOW | Refresh lease returned tokens for an expired/idle session; no per-user session cap. | Lease checks expiry/idle; max 20 sessions per user, oldest dropped. |

## Open (not fixed, owner to know)

| Sev | Finding | Note |
| --- | --- | --- |
| LOW (unsure) | `postgres` may lack DELETE on `vault.secrets` in some Vault versions; logout/expiry/account deletion would then fail. | The "Vault secrets gone" test shows it. |
| LOW (unsure) | Realtime "owner receives" test can fail on a fresh local stack if today's `realtime.messages` partition is missing. | Comment in the test. |
| LOW | `/api/unlock` rate limit is per server instance, resets for everyone at once, and its map has no size bound. Cookie flags (`HttpOnly; Secure; SameSite=Strict; Path=/api`), `no-store` and the `Sec-Fetch-Site` check are fine. | Already known (D61). The Vercel Firewall rule on `/api/unlock` is the real brake — confirm it exists. Retire this path for account users once sign-in ships. |
| — | Revoking `net` functions from PUBLIC may break Dashboard "Database Webhooks" (not used by this app). | Revisit only if webhooks are added. |
| — | Concurrent-submission race not exercised (single-transaction pgTAP). | Lock design reviewed as correct, including the very first submission; a multi-connection test lands with gate 2. |
| — | Not yet reviewable: Edge worker (secret check in constant time, cancel handling, input re-validation), BFF cookie/CSRF code, Realtime "private only" setting. | Gates 1–4. |

## Gate 1: backend sign-in (`api/_lib/{supabase,session,authHandlers,rateLimit}.ts`, `api/auth/*`)

Second separate review, static only (no type check could run: the TypeScript language server would not start here). No critical or high findings. Checked fine: no tokens or secret key in responses or logs, secret key only sent to the Data API, cookie `HttpOnly; Secure; SameSite=Strict; Path=/api`, `private, no-store` on every auth reply, new 256-bit handle per sign-in (no fixation), only the handle's SHA-256 stored, same answer for every email (no account probing), CSRF guard (same-origin + `Origin` + custom `X-PCD-Request` header).

| Sev | Finding | Status |
| --- | --- | --- |
| MED | Any 4xx from Supabase counted as "refused"; one mistyped or rotated key (401) would have signed every user out. | Fixed: only 400/403/422 count as refused; 401/404/other are "no clear answer", 429 is "wait". Test added. |
| MED | A refresh that outlived its 15 s lease had its new tokens dropped while the old refresh token was already spent, so the user was signed out an hour later. | Fixed: save is fenced on the token version only, retried once, lease 35 s. Test added. |
| MED | Rate limiter wiped every count when 10,000 keys filled up, so a flood reset the limit on a victim's email. | Fixed: when full, new keys are refused. Still per server instance (shortcut, noted in code). |
| MED (open) | Anyone can lock one email out of signing in for a minute with 5 wrong codes. | Accepted for the pilot; move to a database counter if abused. |
| LOW | Logout with an expired access token didn't end the Supabase session. | Fixed: refreshes first, then logs out. Leftover Supabase session rows on failure remain a noted shortcut. |
| LOW | A second code request within a minute showed as an outage (503). | Fixed: now 429 "too many attempts". |
| LOW | Origin check skipped when `APP_ORIGIN` unset. | Fixed: sign-in stays off until `APP_ORIGIN` is set. |
| LOW | Parallel tabs gave up after 3 s while one refreshed. | Fixed: wait up to 12 s. |
| Note | Supabase Auth's own per-IP limits see our server's IP, not the reader's, so its "token verifications" limit is shared by all readers. | Fine for a pilot; watch for 429s as users grow. |

## Passwords (`/api/auth/password`, `/api/auth/set-password`) — 2026-11-21

Design: the session stays an opaque random handle in an HttpOnly cookie, with Supabase tokens only on the server (no JWT or PASETO in the browser; nothing to forge, and sign-out is instant). A password is set or replaced only with a fresh emailed code, which is also the "forgot password" path, so a stolen session can't change it and no reset link carries a token through the browser. Third separate review, static only: no critical or high findings; no password in responses, logs or errors; one answer for "no account" and "wrong password"; 72-byte bcrypt limit checked.

| Sev | Finding | Status |
| --- | --- | --- |
| MED | Each `/api/auth/*` route file had its own guess counter, so codes, passwords and set-password each gave 5 tries a minute. | Fixed: one function serves every `/api/auth/<action>`, sharing one counter. Test added. |
| MED | If signing out the other sessions failed after the password changed, they survived. | Fixed: other sessions end first; on failure nothing changes and the code's session is closed. Test added. |
| LOW | Every Supabase refusal was shown as "weak password". | Fixed: reads Supabase's `error_code` (`weak_password`, `same_password`); anything else is "try again". |
| LOW (open) | 5 junk tries a minute can block one email's sign-in for a minute. | Accepted for the pilot (as for codes). |
| LOW (open) | Supabase answers faster for an email with no account, which a patient attacker could time. | Upstream behaviour; noted. |
| LOW (open) | Without `x-real-ip` (only off Vercel) all visitors share one counter. | Fine on Vercel. |

## Sign-in page (`/sign-in`, Settings → Your account) — 2026-11-21

Fourth separate review (front end, static). Contrast on the night colours passes (status green ≈12:1, button text on peach ≈10:1, lilac on dark ≈6.7:1); labels, radio switch, live status and focus rings fine; Settings still makes no network call on a device that never signed in.

| Sev | Finding | Status |
| --- | --- | --- |
| HIGH | Two "Show" buttons shared one name and one state, so the second password box could flip to plain text, and a test would fail. | Fixed: each box has its own Show button ("Show password", "Show new password") and state. |
| HIGH | No way to resend a code, though the error message said "send a new one"; editing the email after sending kept the old code step. | Fixed: "Send a new code" link; editing the email goes back to "Send code". Test added. |
| HIGH | Text links were under the 44 px tap size. | Fixed. |
| MED | "Code sent" could be talked over by moving focus at once. | Fixed: focus moves after a short pause, and the code box is described by the status line. |
| MED | A failing request could leave the button stuck on "One moment…". | Fixed (try/finally). Test added. |
| LOW | Return path after sign-in also rejects backslashes; the peek no longer fires after leaving the password box. | Fixed. |
| LOW (open) | This device remembers the signed-in email (not a token) so Settings knows to ask the server. Sign-out and "nobody signed in" clear it. | Accepted. |

## Wider web for chosen accounts; access code removed (D65) — 2026-11-21

Fifth separate review, static only. **No way around the permission found, and nothing fails open:** both paid endpoints check cross-site, then the signed-in person's permission, before reading the body or calling any provider; only an exact `true` from `bff.can_search_wider_web` allows; any error is 503. The function is service-role only; the table is closed to the API roles; the permission goes with a deleted account (pgTAP). No references to the removed unlock/lock/access-code code remain.

| Sev | Finding | Status |
| --- | --- | --- |
| MED (test) | The "refused search by itself brings the button back" test could pass or fail on timing. | Fixed: waits for the search first. |
| LOW | Local fake mode (`WEB_SEARCH_FAKE`, `CARD_DRAFT_FAKE`) now needs Supabase set up and a permitted account. | Documented in `.env.example` and BACKEND_PLAN; intended (fails closed). |
| LOW (open) | Each paid call may refresh the session first (up to ~12 s waiting on another refresher). | Accepted. |
