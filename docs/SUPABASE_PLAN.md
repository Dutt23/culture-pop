# Supabase integration plan

Research checked on 2026-11-19. Architecture accepted in [ADR D64](DECISIONS.md#d64--supabase-for-account-identity-and-durable-curation); integration is not implemented. No Supabase project, credentials, paid calls or deployment created. Product decisions below remain open before implementation.

## Recommended first version

Keep the React PWA and same-origin `api/` boundary. Use built-in Supabase Auth, Postgres/RLS, Vault, Queues, Cron, Edge Functions and private Realtime Broadcast behind that boundary. The browser receives an opaque HttpOnly app-session cookie. Supabase access/refresh tokens and Parallel/OpenAI/Cloudflare credentials stay on the backend. Start with email OTP login, owner-funded provider calls with per-user quotas, and server-owned jobs that survive closing the browser.

The only app-specific authentication glue is a small backend-for-frontend, abbreviated BFF here, for the owner’s backend-only token requirement. Supabase still handles identity, OTP/password checks, token issuing and refresh. Do not build an auth service or mint app JWTs. Standard Supabase SPA/SSR examples let browser code read session tokens to refresh sessions. Their cookie helpers alone do not implement this stricter backend-only model. The plan makes the BFF responsible for every authenticated request and token refresh. This is an architectural choice for this app. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)

## Existing integration points

| Current code                                         | Change to make                                                                                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~`api/_lib/access.ts`, `api/unlock.ts`, `api/lock.ts`~~ | Done 2026-11-21: removed; replaced by the signed-in session and a per-person permission (`api/_lib/webAccess.ts`). |
| `api/web-search.ts`, `api/draft-card.ts`             | Resolve user server-side, reserve quota atomically, associate request/job with user ID. Reuse provider adapters and request validation.                               |
| `src/app/CurationJobsProvider.tsx`                   | Submit server jobs and observe persisted status. Browser abort controllers cease to own server execution.                                                             |
| `src/data/repositories/curationJobRepository.ts`     | Become account-scoped local cache of server jobs. Five-running-job admission moves to Postgres.                                                                       |
| `src/features/activity/ActivityPage.tsx`             | Show durable progress, reconnect after reload, support retry and idempotent Keep.                                                                                     |
| `src/data/repositories/draftRepository.ts`           | Sync saved cards, user additions, source provenance, style/color and prompt version under the signed-in user.                                                         |
| `src/data/db.ts`, backup/reset repositories          | Namespace account data and define import, account-switch, deletion and offline behavior.                                                                              |

Today jobs and drafts are in IndexedDB. In-app navigation can preserve work, but the browser still initiates the model call. IndexedDB persistence alone cannot keep that call running after the browser exits. Existing wider-web caches and saved-link comments explicitly prohibit cloud sync. Preserve that boundary until provider terms and user consent are reviewed.

## Login and session lifecycle

### Login choices

| Method              | Fit for this app                                                                                     | Proposed priority      |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------- |
| Email OTP           | Users type a code in the existing app, avoiding a password and link-opening confusion across devices | First                  |
| Email magic link    | Low-friction, but callback/device behavior needs testing in the installed PWA                        | Optional after OTP     |
| Email/password      | Useful for users who prefer it, with password reset and recovery flows                               | Later if requested     |
| Google/social OAuth | Familiar sign-in, with provider setup, redirect handling and account-linking decisions               | Optional second method |

Supabase supports email OTP and magic links through the same passwordless API. OTP requires an email-template change. Configure custom SMTP before inviting ordinary users, because built-in SMTP is restricted to authorized project-team addresses. Recommendation is OTP with explicit signup consent and conservative resend/verification limits. [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

### BFF endpoints and token storage

1. `POST /api/auth/otp` validates email, origin and rate limits, then requests an OTP server-side. Return a generic result to limit account enumeration.
2. `POST /api/auth/verify` verifies the code. Generate a cryptographically random app-session handle, store only its digest for lookup, and set an HttpOnly, Secure, SameSite=Lax cookie scoped to `/api`. Rotate the handle after login and any sensitive account change.
3. Keep private session metadata in a Supabase table and the access/refresh token bundle in Supabase Vault. The session row stores a Vault secret UUID, user ID and expiry. The backend loads the decrypted bundle through a narrow privileged database function. Browser responses return minimal user/profile state and quota, never tokens. Use a per-request server client with browser persistence and automatic background refresh disabled.
4. `GET /api/auth/session` returns current app identity. Before protected operations, load the session, acquire a short per-session refresh lease through an atomic database function, refresh expired Supabase credentials, persist the newly rotated bundle before releasing the lease, and verify the resulting identity. Concurrent requests wait/reload the refreshed session. Use a fencing version when committing the new bundle so a stale invocation cannot overwrite newer tokens. Do not hold an ordinary PostgREST transaction open across the remote Auth call. An ambiguous refresh failure needs SDK-supported recovery or reauthentication, rather than blind reuse of an old refresh token.
5. Validate JWT signature, issuer, audience and expiry with the current supported SDK. `getClaims()` verifies signature/expiry through JWKS, while immediate revocation-sensitive actions also need `getUser()` or authoritative session validation. Do not authorize from a decoded JWT or `getSession()` contents alone. [Verified claims](https://supabase.com/docs/reference/javascript/auth-getclaims), [Session revocation distinction](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
6. `POST /api/auth/logout` revokes the chosen Supabase session scope, deletes its encrypted token record, expires the app cookie and clears account data from memory. Decide whether “sign out everywhere” is a separate action.

All mutation endpoints need origin checks and CSRF protection appropriate to cookie auth. Auth/session responses and responses containing `Set-Cookie` use `Cache-Control: private, no-store`. Session handles, OTP values, token hashes and OAuth codes must be redacted from application and hosting logs.

Use the supported Supabase JavaScript SDK on the server for Auth operations. Pin the selected version during implementation. Supabase distinguishes its base client, SSR cookie helpers and stateless server middleware. This BFF owns custom session storage, so choose the package after a small login/refresh spike, rather than applying browser-oriented SSR examples verbatim. [Server-package selection](https://supabase.com/docs/guides/auth/choosing-a-server-package)

## Identity, permissions and provider credentials

Supabase user ID identifies the person. A database quota/credit entry authorizes spending. Provider keys authorize the backend with each upstream provider. Keep those three responsibilities distinct.

For the first version, retain owner-funded provider keys in backend environment secrets. Use the existing authenticated session plus a request idempotency key. No separate client-visible operation token is needed. The browser must never be able to change user ID, credits or upstream key selection.

Parallel Search documents `x-api-key` authentication. Its OAuth provider can obtain a consenting user's actual API key through PKCE. That returned `access_token` is the key itself, so it should not be described as a short-lived per-search credential. A bring-your-own-Parallel-account option could store that key encrypted server-side after a server-owned OAuth callback, with disconnect/revocation UI. It adds billing and account support work, so it is a later product option. [Search authentication](https://docs.parallel.ai/search/search-quickstart), [Parallel OAuth provider](https://docs.parallel.ai/integrations/oauth-provider)

Parallel's separate Account API has ten-minute access tokens and rotating refresh tokens for account/key/balance management through device OAuth. The documented scopes and endpoints do not establish that those bearer tokens authorize ordinary Search calls. No official short-lived, app-minted Search token API was verified in this research. Confirm any provider-delegation requirement directly before building around it. [Parallel Account API](https://docs.parallel.ai/integrations/account-api)

### Tables and authorization

Use private tables for `app_sessions`, `quota_accounts`, `quota_ledger` and worker attempts. Provider credentials stay in backend environment secrets, with per-session Supabase credentials in Vault. User-facing `cards` and `curation_jobs` have `user_id`, timestamps and version fields. Store immutable request/source snapshots on jobs and retain source indices/provenance on cards. Add unique `(user_id, idempotency_key)` and `(user_id, source_job_id)` constraints.

Enable RLS on every user-facing table, grant only required operations, and require ownership for reads/writes. Index `user_id` and ownership lookup paths. Backend calls that access ordinary user rows should carry the verified user's JWT so RLS remains active. Administrative worker/session clients are separate and server-only. Supabase secret/service-role credentials bypass RLS, so use them only for narrowly scoped worker/session functions whose inputs enforce ownership. Test anonymous, owner, other-user and admin paths explicitly. [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [API keys](https://supabase.com/docs/guides/getting-started/api-keys)

## Durable jobs and usage accounting

Submitting a card returns a job ID promptly. A transaction locks the user's quota row, checks credits and fewer than five queued/running jobs, deduplicates the idempotency key, reserves spend, writes immutable job input and enqueues its ID. A retry of the same submission returns the existing job. Quota checks in browser state or per-instance memory cannot enforce this across tabs and server instances.

Use Supabase Queues/`pgmq` for durable delivery. Its visibility timeout hides a claimed message temporarily and permits redelivery after expiry. That guarantee concerns message consumption within a window. It does not guarantee exactly-once calls or billing at an external model/search provider. [Supabase Queues](https://supabase.com/docs/guides/queues), [PGMQ visibility timeout](https://supabase.com/docs/guides/queues/pgmq)

Worker design should include these transitions and checks.

- Claim a queue message and acquire a renewable job lease with a fencing/version token. Extend the queue visibility window while working. A stale worker cannot overwrite a newer terminal result.
- Before each paid provider operation, persist an attempt ID, input hash, provider identity, estimated reservation and dispatch state. Store returned provider request/run IDs before downstream processing when available.
- Use provider idempotency support only where its exact endpoint semantics are documented. When a request times out after possible acceptance, classify outcome as unknown. Reconcile through the provider's request/status API when supported. Otherwise stop for explicit retry and disclose possible extra upstream cost. Do not silently replay an ambiguous paid call.
- Retry safe pre-dispatch failures and documented transient failures with bounded backoff. A queue redelivery first inspects durable attempt state. App credits settle once through a unique ledger entry per attempt/job, even if processing is delivered twice.
- Commit result, final usage and terminal status atomically before acknowledging the queue message. Cleanup expired leases without treating every outstanding request as safe to replay.
- Cancellation changes job state immediately and requests provider cancellation if available. Cancellation after upstream acceptance may still incur a provider charge. Release only unspent reservations.

Use an `AFTER INSERT` trigger on the admitted job row to call the Edge consumer through built-in `pg_net`. The admission transaction writes the job, quota reservation and queue message together. `pg_net.http_post` begins its HTTP request after commit, so the consumer can read committed queue state and rolled-back submissions produce no dispatch. The HTTP response/request ID acknowledges dispatch separately from completion. The Edge consumer authenticates the service request, claims a bounded queue batch and follows the lease/attempt rules above. [Database Webhooks](https://supabase.com/docs/guides/database/webhooks), [pg_net transaction semantics](https://supabase.com/docs/guides/database/extensions/pg_net)

Keep the project URL and service credential in Vault and read them inside a tightly privileged trigger function with a fixed search path. The Supabase Dashboard webhook helper can place its secret in trigger SQL. Use the documented Vault-backed migration pattern to keep it out of source. `pg_net` temporarily holds request headers in its internal request queue, so database-role permissions and log redaction still matter. Send only a job ID or dispatch marker, with no raw user text in the webhook payload. [Webhook secrets and Vault](https://supabase.com/docs/guides/database/webhooks)

The durable queue remains authoritative when the dispatch notification fails or disappears. `pg_net` uses unlogged request/response tables, so Cron performs recovery and maintenance only, checking queued work or expired leases and invoking the same consumer when needed. A proposed five-minute recovery schedule scans 8,640 times per 30-day month, while a conditional database function invokes Edge only when recovery work exists. Ordinary jobs get the post-commit kick immediately instead of waiting for that interval. Duplicate kicks converge through queue claims and job leases. Measure admission-to-worker-start latency and cold starts before release. [pg_net request storage](https://supabase.com/docs/guides/database/extensions/pg_net)

Dispatch adds roughly one Edge invocation per normal job, plus bounded continuation/recovery invocations. Record those alongside provider usage when estimating free-plan limits. Current hosted Edge limits include 150-second free-plan wall time and 400-second paid-plan wall time, with a two-second CPU allowance per request. Bound each invocation and renew queue visibility while working. Measure the reported 22-second baseline by extraction/model/verification stage, then compare unchanged provider work with the queue version. Immediate dispatch avoids adding a scheduled wait, but does not promise faster provider responses. [Edge Function limits](https://supabase.com/docs/guides/functions/limits)

## Progress transport

Keep the job row as source of truth. Every progress event has job ID, monotonic version, stage and timestamp. Send metadata rather than full prompts/evidence. Reconnect always fetches a fresh authorized job snapshot before applying newer events.

Supabase Realtime uses WebSockets. Private Broadcast supports authorization policies on `realtime.messages`, and clients normally supply a JWT. Direct browser subscriptions would require exposing a scoped token to JavaScript, which conflicts with the chosen backend-only session model. Use private Supabase Realtime Broadcast on the server and relay small status events through the existing same-origin BFF as SSE. The BFF verifies ownership and handles reconnect/cursor state. The browser holds only the app cookie. A direct browser Realtime connection is a different token-boundary choice to approve explicitly. Do not assume an HttpOnly cookie for our domain authenticates a direct Supabase WebSocket. [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [Realtime JWT updates](https://supabase.com/docs/reference/javascript/setauth)

Use the SSE relay for push updates and keep worker execution independent of the stream. Hosting duration/connection limits need a deployment-specific spike. One bounded stream per user/session observes several jobs. On host-imposed closure or connection loss, reconnect with backoff and fetch an authorized current snapshot/cursor once before resuming newer events. Browser uses push updates and reconnect recovery, with no periodic status polling. Reconnect or a closed tab has no effect on worker ownership. Use the built-in Broadcast/database trigger path for status changes, with the backend relay carrying only authorized metadata. [Database change subscriptions](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)

## Offline, privacy and lifecycle

Keep built-in/public reference content usable offline. Account caches must be keyed by user ID or stored in separate account databases. Logout/account switch clears rendered state, subscriptions, pending in-memory requests and account cache access before showing another account. An offline cookie cannot prove the current server identity. Show cached data only under an explicit previously signed-in/offline mode and never submit queued paid work until reauthentication succeeds.

Existing anonymous favourites/cards need an explicit one-time import into the chosen account. Preview counts, preserve local IDs with import IDs for deduplication, upload only user-approved eligible records, and mark completion transactionally. A second account must not inherit the first account's anonymous import. Conflict resolution should use version/tombstone checks, with user review for simultaneous edits instead of last-write-wins data loss.

Wider-web results/snippets and bookmarked links currently have local-only contractual/product rules in `webResultRepository.ts`, `db.ts` and `BACKEND_PLAN.md`. Keep those stores out of sync. Before moving raw job source snapshots or generated cards to Supabase, review applicable upstream retention/licensing terms and update the privacy/consent wording. Search history stays local unless the user opts into a separately specified sync feature.

Proposed retention starts with seven days for completed/failed job payloads, thirty days for operational metadata and user-controlled retention for saved cards. These are product defaults to approve, not provider requirements. Account deletion cancels owned queued work, deletes server cards/jobs/provider credentials/sessions, clears local account caches and records a deletion tombstone for sync. Document the backup expiry window so deletion promises match restores.

Supabase Vault encrypts values on disk and exposes a decrypted view at query time. Restrict Vault view/function privileges to the backend and never expose a decrypted token view through the Data API. Supabase manages the project encryption key separately from database data. Update one session’s Vault secret after serialized token refresh and delete it on logout. Benchmark per-session read/update volume in the auth spike. Vault does not eliminate the need for authorization or safe logs. [Supabase Vault](https://supabase.com/docs/guides/database/vault)

Supabase Pro includes seven days of daily database backups. Free projects should maintain their own exports. Database backups do not include Storage objects. Test restores and prevent restored deleted-account data from becoming visible before deletion tombstones are reapplied. Keep Vault credentials encrypted in exports and include the documented Vault key/restore procedure in the restore test. [Database backups](https://supabase.com/docs/guides/platform/backups)

## Logging and cost controls

Log request/job/attempt IDs, pseudonymous user ID, operation/model/prompt version, stage timings, status/error code, token counts, cached-token counts where reported, extracted URL count and estimated/actual cost. Include idempotency/lease outcomes needed to diagnose double dispatch. Keep raw searches, user text, extracted pages, emails, passwords, OTPs, cookies, authorization headers and provider keys out of routine logs. Debug content capture needs separate explicit consent, access controls and expiry.

Maintain a database usage ledger for limits and user-visible balances. Hosting/Supabase logs support diagnosis and cannot act as a transactional billing ledger. Add queries in Supabase’s existing dashboard for queue age, error rate, unknown provider outcomes, reserved versus settled spend and per-user consumption. Keep global provider spend caps as an outer limit.

### Budget sketch

Prices below were checked on 2026-11-19 and exclude tax and optional services.

| Item             | Published starting allocation/rate                                             | Planning implication                                                                   |
| ---------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Supabase Free    | $0, 500 MB database, 50,000 MAU and 5 GB egress                                | Suitable for a small pilot, with inactivity pausing and independent backups considered |
| Supabase Pro     | From $25/month, first project included, 8 GB database and 100,000 MAU          | Production baseline estimate before worker, email and model costs                      |
| Realtime Free    | 2 million messages/month and 200 peak connections                              | Budget connection/message traffic if direct/relayed Realtime is adopted                |
| Realtime Pro     | 5 million messages/month and 500 peak connections, then published overage      | Avoid streaming every model token into database broadcasts                             |
| Parallel Search  | Fast/turbo $1 per 1,000 requests with ten results, basic/advanced $5 per 1,000 | Record mode and result count for estimates                                             |
| Parallel Extract | $1 per 1,000 URLs                                                              | Ten URLs per draft cost roughly $0.01 before LLM calls                                 |

Supabase quotas and base-plan prices come from its current pricing page. Realtime overages are separately metered. Parallel API mode/result pricing comes from its API pricing documentation. [Supabase pricing](https://supabase.com/pricing), [Realtime pricing](https://supabase.com/docs/guides/realtime/pricing), [Parallel API pricing](https://docs.parallel.ai/getting-started/pricing)

An illustrative 1,000-draft month with one ten-result fast search and ten extracted URLs per draft is about $11 in Parallel list-price work, before credits, retries and LLM costs. Supabase Pro would add a starting $25, plus SMTP, hosting/worker use and LLM usage. Existing provider/model pricing must be checked when implementation fixes the model and token budget. A free allowance does not replace admission quotas or a hard global spend cap.

## Implementation phases and gates

1. **Auth spike** — local Supabase environment, OTP/custom SMTP configuration, BFF opaque session, refresh locking, logout and account switch. Verify PWA redirects, CSRF, expired/revoked sessions, multiple concurrent refreshes and no token leakage in bundle/storage/logs. Choose region and the first login method.
2. **Per-user data and quota** — migrations, RLS/grants, quota ledger, idempotent submission and five-job atomic admission. Exercise two users and concurrent tabs/server processes, duplicate submissions, rollback and insufficient-credit paths before paid providers are enabled.
3. **Durable worker** — atomic admission, post-commit webhook kick, queue/lease/fencing, provider attempts, safe retry policy, cancellation and Cron recovery. Kill a worker before dispatch, after acceptance, after result persistence and before queue acknowledgement. Prove one settled app charge, and disclose unreconcilable upstream outcomes.
4. **Activity/reconnect** — BFF job APIs plus the Realtime-to-SSE relay, cached account UI and completed-card Keep. Verify browser closed/reopened during work, lost events, reordered events, offline/relogin and cross-account isolation.
5. **Controlled sync and release** — owner-approved local import, retention/deletion jobs, backup/restore test, cost telemetry and limited-user pilot. Preserve existing query evaluation corpus and run request/provider, RLS, concurrency, offline and mobile E2E checks. Add live cost/cache-hit measurements using a small explicitly budgeted run.

## Decisions still open

- Owner-funded quotas versus user-connected Parallel accounts, and whether credits represent requests, estimated dollars or a subscription allowance.
- Pilot region, SMTP provider, signup/invite policy, email OTP versus optional social login, and session lifetime/revocation behavior.
- Validate built-in Edge Function execution limits and the small Realtime-to-SSE relay on the existing host. Keep provider and Supabase session credentials server-side.
- Retention periods, eligible card/source content for cloud storage, anonymous-data import and account deletion policy.
- Provider idempotency/status lookup support for every paid endpoint. No exactly-once upstream billing claim is justified without that verification.

No runtime code or infrastructure was changed by this plan. Actual auth flows, RLS policies, worker durability, cost and provider credential delegation remain untested until implementation.
