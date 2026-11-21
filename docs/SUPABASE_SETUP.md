# Supabase setup checklist (owner)

What you do by hand to get Supabase ready for D64. Do the steps in this order. Nothing here asks you to paste a key into chat, the repo or a file: keys go only into the Supabase and Vercel dashboards.

Status: written 2026-11-20, nothing deployed. The database files are in `supabase/migrations/`; their tests are in `supabase/tests/database/`. The app code that uses them (sign-in, worker, live progress) comes after you've reviewed this.

## What the database files make

| File                               | In plain words                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `…0100_base_schema.sql`            | The tables: your users' card requests ("jobs"), kept cards, credit balances, a credit history, a record of every paid AI/search call, and sign-in sessions. Everyone can see only their own rows.                                                                                                                                                                                                                                                                                                                                                    |
| `…0200_jobs_and_quota.sql`         | The rules for starting a card: one at a time per person (even from two tabs), at most 5 running, costs 1 credit, the same request twice makes one job. The credit comes back if the card fails or is cancelled before the AI or search was asked; once they were asked, it is used (the owner paid for it). Only our server can start or cancel a card, never the browser or anyone holding a Supabase sign-in directly. Also the steps the background worker takes, built so a stuck or duplicated worker can't finish a job twice or charge twice. |
| `…0300_sessions.sql`               | Where the server keeps each person's Supabase sign-in, encrypted in Supabase Vault. The browser only gets a random cookie.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `…0400_dispatch_realtime_cron.sql` | Wakes the worker the moment a job is saved; sends "job moved to stage X" updates on a private channel per person; every 5 minutes checks for work nobody picked up; every night deletes old job text (7 days) and old job records (30 days).                                                                                                                                                                                                                                                                                                         |

Defaults you can change later with one SQL line (they live in the `app_private.policy` table): 10 starting credits per new person, 1 credit per card, 5 cards at once, 500 cards per day across everyone, sign-out after 14 idle days or 30 days total. These are open product decisions from `SUPABASE_PLAN.md`; tell me if you want different numbers before we start.

## 1. Create the project

1. In the Supabase dashboard, **New project**. Name it e.g. `pop-culture-decoder`.
2. **Region**: pick the one closest to where the Vercel functions run (Vercel's default is Washington, D.C., so **East US (North Virginia)**). This can't be changed later.
3. Use a long generated **database password** and save it in your password manager. You won't need to give it to anyone.
4. Free plan is fine for the pilot. Note: free projects pause after a week with no use, and have no automatic backups.

## 2. Run the database files

Easiest way, no tools needed:

1. Dashboard → **SQL Editor** → **New query**.
2. Open `supabase/migrations/20261120000100_base_schema.sql` from the repo, copy all of it, paste, **Run**. It should say "Success. No rows returned".
3. Repeat for `…0200…`, `…0300…`, `…0400…`, in that order. Each file depends on the one before.

If a file fails, stop and send me the error message (the red text). Don't re-run earlier files.

## 3. Data API (Settings → API, or Integrations → Data API)

- **Exposed schemas**: keep `public` and `graphql_public`; **add `bff`**. That is how our server reaches the session and worker functions. Only the secret server key can use it; signed-in users and visitors can't.
- Do **not** add `app_private`, `vault`, `pgmq` or `pgmq_public`.
- Integrations → **Queues**: leave "Expose Queues via PostgREST" **off**.

## 4. Sign-in (Authentication)

**Sign In / Providers**

- **Email**: on. **Confirm email**: on. **Secure email change**: on.
- Phone and all social logins: off for now.
- **Email OTP expiration**: 600 seconds (10 minutes). **Email OTP length**: 6.
- **Password**: minimum length 10. Leave "Secure password change" on. People set a password from the app with an emailed code, so the reset-link email isn't used.
- **Allow new users to sign up**: your call (open decision). For a small pilot, turn it **off** and add people under Authentication → Users → **Invite user**; they then sign in with a code.

**Email Templates**

- In **Magic Link** and **Confirm signup**, the message must show the code: include `{{ .Token }}` (for example "Your Pop Culture Decoder code is {{ .Token }}"). Without it people get a link instead of a code.

**SMTP (Settings → Authentication → SMTP)**

- Supabase's own mailer only sends to your team's addresses. Before inviting anyone else, connect a mail provider (e.g. Resend, Postmark, Amazon SES). Type its username/password into the dashboard only.

**URL Configuration**

- **Site URL**: the production address of the app.
- **Redirect URLs**: the production address and `http://localhost:3000`. Codes don't use redirects, but sign-up confirmation emails do.

**Rate limits**: keep the defaults; lower "emails per hour" if you want a tighter brake on sign-in spam.

**Sessions**: leave **refresh token rotation** on (default) with the default reuse interval. The app signs people out itself after 14 idle / 30 total days, so the paid "time-box" setting isn't needed.

**JWT Keys** (Settings → JWT Keys): if offered, **migrate to the new asymmetric signing keys**. Our server then checks sign-ins without asking Supabase each time.

## 5. Realtime (Realtime → Settings)

- Turn **off "Allow public access"**, so only private channels exist. The database files already say who may hear what: each person hears only their own jobs, and nobody can send on those channels from outside.

## 6. Keys: which name goes where

Get keys from Settings → **API Keys**. Use the new **publishable** (`sb_publishable_…`) and **secret** (`sb_secret_…`) keys, not the legacy anon/service_role ones.

**Vercel** (Project → Settings → Environment Variables). Mark each **Sensitive**. Production only for now.

| Name                       | What                                                                                                                                                                                                       | Secret?                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `SUPABASE_URL`             | Project URL, `https://<ref>.supabase.co`, no slash at the end                                                                                                                                              | no                             |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key                                                                                                                                                                                            | no, but server-only anyway     |
| `SUPABASE_SECRET_KEY`      | Secret key                                                                                                                                                                                                 | **yes — never in the browser** |
| `APP_ORIGIN`               | The app's own address exactly as the browser shows it, no slash at the end, e.g. `https://your-app.vercel.app`. Required: without it sign-in stays switched off. Used to refuse requests from other sites. | no                             |

None of them may start with `VITE_`: anything named `VITE_…` is copied into the browser code.

**Preview deployments:** every Vercel preview gets its own address (`https://<project>-<hash>.vercel.app`), so the Production `APP_ORIGIN` doesn't match it and sign-in on a preview answers "Signing in isn't working right now" (the server refuses it as another site). That is on purpose. To try sign-in on a preview, set `APP_ORIGIN` for the Preview environment to that preview's exact address (or a fixed preview domain you add in Vercel), and add the same address to Supabase's Redirect URLs.

**On this device:** after you sign in, the app remembers your email in this browser's storage (not a password or token), so Settings knows to ask the server whether you're still signed in. Signing out removes it.

Existing Vercel variables stay as they are: `PARALLEL_API_KEY`, `OPENAI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`.

**Delete these two** once the per-person wider web search is deployed: `ACCESS_CODE` and `ACCESS_COOKIE_SECRET` (Vercel → Settings → Environment Variables, and from your `.env`). Nothing reads them any more: the shared access code is gone.

**Supabase Edge Function secrets** (Edge Functions → Secrets). Only needed once the worker exists (step 8):

| Name                                                                                  | What                                                                                                                               |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `WORKER_SECRET`                                                                       | A long random string you generate (e.g. a 40-character password from your password manager). Same value goes into Vault in step 8. |
| `PARALLEL_API_KEY`, `OPENAI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Same values as on Vercel, so the worker can make the calls.                                                                        |

`SUPABASE_URL` and the server key are given to Edge Functions automatically; don't add them.

## 7. Check the files did what they should (optional, needs Docker)

On a computer with Docker Desktop and the Supabase CLI, from the repo folder:

```bash
supabase init
```

(say no to the VS Code questions; skip if a `supabase/config.toml` already exists)

```bash
supabase start
```

```bash
supabase test db
```

The last one should end with `All tests successful`. If not, send me the output. `supabase stop` shuts it down. This runs on your computer only and touches nothing in the real project.

## Turn on wider web search for a person

Wider web search and AI card drafts are only for people you choose. Run the migration `supabase/migrations/20261121000100_wider_web_access.sql` in the SQL Editor once, like the others. Then, for each person (they must have signed in at least once, or been invited):

```sql
insert into app_private.wider_web_access (user_id, note)
select id, 'friend' from auth.users where email = 'person@example.com'
on conflict do nothing;
```

To turn it off again:

```sql
delete from app_private.wider_web_access
where user_id = (select id from auth.users where email = 'person@example.com');
```

It takes effect on their next search. Signed-out people see "Sign in to search the wider web"; signed-in people without it see that it isn't turned on for them yet.

## Live sign-in test (on your computer only)

A real sign-in, check and sign-out against your Supabase project, in a real browser. It runs only when you start it; GitHub (CI) doesn't run it. We can switch it on in CI later, once the setup has settled.

1. Make a test user by hand in Supabase (Authentication → Users → Add user, with a password, "Auto confirm" on).
2. Add two lines to `.env` with that user's email and password: `E2E_USER_EMAIL=` and `E2E_USER_PASSWORD=`.
3. Run:

```bash
npm run test:e2e:live
```

It starts the app and its server on port 3000 by itself. Without those two lines it stops and says which ones are missing. The normal checks (`npm run test:e2e`, `npm run deploy:check`, GitHub) never include it.

## 8. Later, when the worker is built (gate 3)

After the `curation-worker` Edge Function is deployed, tell the database where it is. In **SQL Editor**, run this, replacing the two quoted placeholders with the real values yourself (don't send them to anyone):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/curation-worker', 'pcd_worker_url');
select vault.create_secret('<same value as WORKER_SECRET>', 'pcd_worker_secret');
```

Until then, card requests wait in the queue and the database logs "worker kick skipped". Nothing breaks and nobody is charged.

## Race check (not done yet)

The database file serialises each person's submissions by locking their credit row, so two tabs can't both start a 6th card or spend the same credit. The tests above check the rules one request at a time. A test that fires many requests at once from separate connections comes with gate 2 (per-user data and quota), before any paid provider is switched on.

## Changing a default later

Example, give everyone 20 starting credits (only affects people who haven't started a card yet):

```sql
update app_private.policy set starter_credits = 20;
```

Give one person 10 more credits:

```sql
with u as (select id from auth.users where email = 'person@example.com')
, q as (update app_private.quota_accounts set available = available + 10 where user_id = (select id from u) returning user_id)
insert into app_private.quota_ledger (user_id, kind, credits, note) select user_id, 'grant', 10, 'manual' from q;
```

## What differed when we set it up (2026-11-21)

**Done:** step 1 (project in East US, standard Postgres, not OrioleDB), step 2 (all four files ran without errors), step 3 (`bff` exposed, Queues not exposed), step 4 (sign-ups off, email sign-in and password settings, Sessions, JWT keys) except SMTP and email templates, and step 5 (Realtime public access off).

**Still to do:** SMTP and the two email templates with `{{ .Token }}` (needs a domain to send from; until then sign-in codes don't arrive), the live Site URL and step 6 (once the app is on Vercel), and step 8 (when the worker exists).

Notes from the first real setup, where the dashboard didn't match the steps above.

- **Email templates are locked until custom SMTP is set up.** Authentication → Emails shows "Set up custom SMTP to edit templates", and the subject and body can't be edited before that. The default templates send a link, not a code. Do the **SMTP** part of step 4 before **Email Templates**, or sign-in codes won't arrive.
- **Authentication sidebar layout (Nov 2026):** Manage (Users, OAuth Apps) · Notifications (Emails) · Configuration (Policies, Sign In / Providers, Passkeys, OAuth Server, Sessions, Rate Limits, Multi-Factor, URL Configuration, Attack Protection, Auth Hooks, Audit Logs, Performance). The password and code settings in step 4 weren't under Sign In / Providers → Email as written; look in **Attack Protection** (password rules) and the **Email** panel or the **Emails** page (code length and expiry).
- **Password and code settings are in the Email provider panel** (Sign In / Providers → click the Email row). Attack Protection only has CAPTCHA (left off) and "Prevent use of leaked passwords", which shows DISABLED with a "Configure in email" button. We left it off on the free plan.
- **No Vercel project yet**, so Site URL and Redirect URLs were set to `http://localhost:3000` only. When the app is on Vercel: change Site URL to the live address, add it to Redirect URLs, and do step 6 (Vercel variables).
