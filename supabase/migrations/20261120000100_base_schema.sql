-- Pop Culture Decoder: accounts, durable curation jobs, quota and sessions (D64, docs/SUPABASE_PLAN.md).
--
-- Layout
--   public       user-facing tables the signed-in user may read through RLS (cards, curation_jobs).
--   app_private  internal tables: sessions, quota, ledger, provider attempts, policy. Never exposed.
--   bff          functions only the backend (service role) may call: sessions and the worker.
--
-- Nothing here holds a provider key. Supabase access/refresh tokens live in Vault, referenced by id.

create extension if not exists pgmq;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
-- supabase_vault is installed on every Supabase project already.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create schema if not exists bff;
revoke all on schema bff from public, anon, authenticated;
grant usage on schema bff to service_role;

-- ---------------------------------------------------------------------------------------------
-- Policy: one row the owner edits with SQL. Product defaults from SUPABASE_PLAN.md, still open.
-- ---------------------------------------------------------------------------------------------
create table app_private.policy (
  id boolean primary key default true check (id),
  starter_credits integer not null default 10 check (starter_credits >= 0),
  credits_per_job integer not null default 1 check (credits_per_job > 0),
  max_active_jobs integer not null default 5 check (max_active_jobs between 1 and 20),
  -- shortcut: counted without a lock, so concurrent submissions can pass it by a few jobs. It is an
  -- outer brake under the provider dashboards' own spend caps; use a locked counter if it must be exact.
  global_daily_job_cap integer not null default 500 check (global_daily_job_cap >= 0),
  job_payload_days integer not null default 7 check (job_payload_days >= 1),
  job_metadata_days integer not null default 30 check (job_metadata_days >= 1)
);
insert into app_private.policy default values;

-- ---------------------------------------------------------------------------------------------
-- Quota: available credits plus credits held by queued/running jobs. Ledger is append-only.
-- ---------------------------------------------------------------------------------------------
create table app_private.quota_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  available integer not null check (available >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Jobs: one row per card request. Input is an immutable snapshot; the worker owns status.
-- ---------------------------------------------------------------------------------------------
create table public.curation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,100}$'),
  -- queued -> running -> completed | failed | cancelled | unknown. "unknown" = a paid provider call
  -- may or may not have happened; never replayed automatically (SUPABASE_PLAN.md, worker rules).
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled', 'unknown')),
  stage text,
  progress_version bigint not null default 0,
  input jsonb check (input is null or pg_column_size(input) <= 102400),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  prompt_version text not null check (length(prompt_version) <= 40),
  reserved_credits integer not null check (reserved_credits >= 0),
  result jsonb check (result is null or pg_column_size(result) <= 102400),
  error_code text check (error_code is null or length(error_code) <= 60),
  cancel_requested_at timestamptz,
  -- lease + fence: a worker holding an old fence can't overwrite a newer worker's result.
  lease_owner uuid,
  lease_until timestamptz,
  fence bigint not null default 0,
  queue_msg_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  payload_purged_at timestamptz,
  unique (user_id, idempotency_key)
);
create index curation_jobs_user_created on public.curation_jobs (user_id, created_at desc);
create index curation_jobs_active on public.curation_jobs (user_id) where status in ('queued', 'running');
create index curation_jobs_running_lease on public.curation_jobs (lease_until) where status = 'running';
create index curation_jobs_created on public.curation_jobs (created_at);

create table app_private.quota_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.curation_jobs (id) on delete set null,
  kind text not null check (kind in ('grant', 'reserve', 'settle', 'release')),
  credits integer not null check (credits >= 0),
  note text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now()
);
-- A job is reserved once and closed (settle or release) once, even if the worker runs twice.
create unique index quota_ledger_job_reserve on app_private.quota_ledger (job_id)
  where kind = 'reserve';
create unique index quota_ledger_job_close on app_private.quota_ledger (job_id)
  where kind in ('settle', 'release');
create index quota_ledger_user on app_private.quota_ledger (user_id, created_at desc);
create index quota_ledger_reserved_on on app_private.quota_ledger (created_at) where kind = 'reserve';

-- Every paid provider call is written down before it is sent.
create table app_private.job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.curation_jobs (id) on delete cascade,
  fence bigint not null,
  provider text not null check (provider in ('parallel', 'openai', 'cloudflare')),
  operation text not null check (length(operation) <= 40),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  -- dispatching: about to send. accepted: provider took it. unknown: timed out after possible
  -- acceptance. succeeded/failed: outcome known.
  state text not null default 'dispatching'
    check (state in ('dispatching', 'accepted', 'succeeded', 'failed', 'unknown')),
  provider_request_id text check (provider_request_id is null or length(provider_request_id) <= 200),
  estimated_cost_micros bigint not null default 0 check (estimated_cost_micros >= 0),
  actual_cost_micros bigint check (actual_cost_micros is null or actual_cost_micros >= 0),
  usage jsonb check (usage is null or pg_column_size(usage) <= 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_attempts_job on app_private.job_attempts (job_id);

-- ---------------------------------------------------------------------------------------------
-- Cards the user kept. Synced from a completed job ("Keep"); one card per job per user.
-- ---------------------------------------------------------------------------------------------
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_job_id uuid references public.curation_jobs (id) on delete set null,
  card jsonb not null check (pg_column_size(card) <= 65536),
  color text check (color in ('lavender', 'sage', 'peach')),
  prompt_version text check (length(prompt_version) <= 40),
  version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_job_id)
);
create index cards_user_updated on public.cards (user_id, updated_at desc);

-- ---------------------------------------------------------------------------------------------
-- Backend sessions. The browser cookie holds a random handle; only its SHA-256 digest is stored.
-- ---------------------------------------------------------------------------------------------
create table app_private.app_sessions (
  id uuid primary key default gen_random_uuid(),
  handle_digest bytea not null unique check (octet_length(handle_digest) = 32),
  user_id uuid not null references auth.users (id) on delete cascade,
  vault_secret_id uuid not null,
  token_version bigint not null default 1,
  refresh_lease_owner uuid,
  refresh_lease_until timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index app_sessions_user on app_private.app_sessions (user_id);
create index app_sessions_expires on app_private.app_sessions (expires_at);

-- ---------------------------------------------------------------------------------------------
-- Grants. Supabase grants every new public table to anon/authenticated by default: take it back.
-- ---------------------------------------------------------------------------------------------
revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all sequences in schema app_private from public, anon, authenticated;

revoke all on public.curation_jobs from public, anon, authenticated;
revoke all on public.cards from public, anon, authenticated;
-- Jobs are created, changed and cancelled only through backend functions; the user can only read.
-- No delete: the job row anchors the record of paid calls; retention removes it after 30 days.
grant select on public.curation_jobs to authenticated;
grant select, insert, update, delete on public.cards to authenticated;

alter table public.curation_jobs enable row level security;
alter table public.cards enable row level security;
alter table app_private.quota_accounts enable row level security;
alter table app_private.quota_ledger enable row level security;
alter table app_private.job_attempts enable row level security;
alter table app_private.app_sessions enable row level security;
alter table app_private.policy enable row level security;
-- No policies on app_private tables: only table owners and service_role (bypass) can touch them.

create policy "own jobs: read" on public.curation_jobs
  for select to authenticated using (user_id = (select auth.uid()));

create policy "own cards: read" on public.cards
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own cards: add" on public.cards
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      source_job_id is null
      or exists (
        select 1 from public.curation_jobs j
        where j.id = source_job_id and j.user_id = (select auth.uid()) and j.status = 'completed'
      )
    )
  );
create policy "own cards: change" on public.cards
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "own cards: remove" on public.cards
  for delete to authenticated using (user_id = (select auth.uid()));

-- A card can't be moved onto another job after it is kept.
create function app_private.cards_freeze_source() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.source_job_id is distinct from old.source_job_id and new.source_job_id is not null then
    raise exception 'source_job_id is fixed' using errcode = '42501';
  end if;
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end $$;
create trigger cards_freeze_source before update on public.cards
  for each row execute function app_private.cards_freeze_source();
