-- Shared limits (security review before production, 2026-11-21): daily wider-web searches and card
-- drafts per person and for everyone, and sign-in attempts per email and per visitor. They used to
-- be counted in each server instance's memory, so every instance had its own allowance.
--
-- Each counter moves with one statement that only increases while under the limit, so any number of
-- requests at the same moment can't take more than the limit allows. Only the backend can call the
-- functions. Change the numbers with SQL (docs/SUPABASE_SETUP.md, "Limits").

alter table app_private.policy
  add column web_search_per_user_daily integer not null default 30 check (web_search_per_user_daily >= 0),
  add column web_search_global_daily integer not null default 150 check (web_search_global_daily >= 0),
  add column card_draft_per_user_daily integer not null default 10 check (card_draft_per_user_daily >= 0),
  add column card_draft_global_daily integer not null default 50 check (card_draft_global_daily >= 0),
  add column auth_window_seconds integer not null default 60 check (auth_window_seconds between 10 and 3600),
  add column otp_per_email integer not null default 3 check (otp_per_email >= 0),
  add column otp_per_visitor integer not null default 10 check (otp_per_visitor >= 0),
  add column guesses_per_email integer not null default 5 check (guesses_per_email >= 0),
  add column guesses_per_visitor integer not null default 10 check (guesses_per_visitor >= 0);

-- One row per UTC day, counter and kind. `subject` is 'global' or a user id.
create table app_private.daily_usage (
  day date not null,
  subject text not null check (subject = 'global' or subject ~ '^[0-9a-f-]{36}$'),
  kind text not null check (kind in ('web_search', 'card_draft')),
  used integer not null check (used >= 0),
  primary key (day, subject, kind)
);

-- Sign-in attempts in a fixed window. `key_digest` is a SHA-256 of the email or the visitor's IP,
-- made by the backend, so the table never holds an address in plain text.
create table app_private.auth_attempts (
  bucket text not null check (bucket in ('otp_email', 'otp_visitor', 'guess_email', 'guess_visitor')),
  key_digest text not null check (key_digest ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  used integer not null check (used >= 0),
  primary key (bucket, key_digest)
);

alter table app_private.daily_usage enable row level security;
alter table app_private.auth_attempts enable row level security;
revoke all on app_private.daily_usage, app_private.auth_attempts from public, anon, authenticated;

-- Adds one to a counter if it is under `p_cap`; true if it did.
create function app_private.take_one(p_day date, p_subject text, p_kind text, p_cap integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_used integer;
begin
  if p_cap <= 0 then
    return false;
  end if;
  insert into app_private.daily_usage as u (day, subject, kind, used)
    values (p_day, p_subject, p_kind, 1)
    on conflict (day, subject, kind) do update set used = u.used + 1 where u.used < p_cap
    returning used into v_used;
  return v_used is not null;
end $$;

-- One wider-web search or card draft for this person today: 'ok', 'user_cap' or 'global_cap'.
-- Both counters move in this one transaction; if the shared one is full, the person's step is undone.
create function bff.take_web_credit(p_user uuid, p_kind text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_policy app_private.policy;
  v_day date := (now() at time zone 'utc')::date;
  v_user_cap integer;
  v_global_cap integer;
begin
  if p_user is null or p_kind not in ('web_search', 'card_draft') then
    raise exception 'bad credit request' using errcode = '22023';
  end if;
  select * into strict v_policy from app_private.policy;
  v_user_cap := case p_kind when 'web_search' then v_policy.web_search_per_user_daily
                            else v_policy.card_draft_per_user_daily end;
  v_global_cap := case p_kind when 'web_search' then v_policy.web_search_global_daily
                              else v_policy.card_draft_global_daily end;
  if not app_private.take_one(v_day, p_user::text, p_kind, v_user_cap) then
    return 'user_cap';
  end if;
  if not app_private.take_one(v_day, 'global', p_kind, v_global_cap) then
    update app_private.daily_usage set used = used - 1
      where day = v_day and subject = p_user::text and kind = p_kind;
    return 'global_cap';
  end if;
  return 'ok';
end $$;

-- One sign-in attempt in this bucket for this key: true if still under the limit for the window.
create function bff.take_auth_attempt(p_bucket text, p_key_digest text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_policy app_private.policy;
  v_limit integer;
  v_used integer;
  v_window interval;
begin
  if p_key_digest is null or p_key_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'bad attempt key' using errcode = '22023';
  end if;
  select * into strict v_policy from app_private.policy;
  v_limit := case p_bucket
    when 'otp_email' then v_policy.otp_per_email
    when 'otp_visitor' then v_policy.otp_per_visitor
    when 'guess_email' then v_policy.guesses_per_email
    when 'guess_visitor' then v_policy.guesses_per_visitor
  end;
  if v_limit is null then
    raise exception 'bad attempt bucket' using errcode = '22023';
  end if;
  v_window := make_interval(secs => v_policy.auth_window_seconds);
  insert into app_private.auth_attempts as a (bucket, key_digest, window_start, used)
    values (p_bucket, p_key_digest, now(), 1)
    on conflict (bucket, key_digest) do update set
      used = case when a.window_start <= now() - v_window then 1 else a.used + 1 end,
      window_start = case when a.window_start <= now() - v_window then now() else a.window_start end
    returning used into v_used;
  return v_used <= v_limit;
end $$;

-- Old counters go nightly: attempts after a day, daily usage after 30 days.
create function app_private.purge_limits() returns void
language sql security definer set search_path = '' as $$
  delete from app_private.auth_attempts where window_start < now() - interval '1 day';
  delete from app_private.daily_usage where day < (now() at time zone 'utc')::date - 30;
$$;

revoke all on all functions in schema app_private from public, anon, authenticated;
revoke all on function bff.take_web_credit(uuid, text) from public, anon, authenticated;
revoke all on function bff.take_auth_attempt(text, text) from public, anon, authenticated;
grant execute on function bff.take_web_credit(uuid, text) to service_role;
grant execute on function bff.take_auth_attempt(text, text) to service_role;

select cron.schedule('pcd-purge-limits', '27 3 * * *', 'select app_private.purge_limits()');

-- Logout also ends the Supabase session itself (its refresh token stops working at once), not only
-- our copy. The token bundle carries Supabase's `session_id` (taken from the access token when the
-- session is saved, api/_lib/supabase.ts). Older bundles without it are only forgotten, as before.
create or replace function bff.end_session(p_handle_digest bytea) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_session app_private.app_sessions;
  v_tokens text;
  v_auth_session uuid;
begin
  select * into v_session from app_private.app_sessions
    where handle_digest = p_handle_digest for update;
  if not found then
    return null;
  end if;
  select d.decrypted_secret into v_tokens from vault.decrypted_secrets d
    where d.id = v_session.vault_secret_id;
  delete from app_private.app_sessions where id = v_session.id;
  -- Any odd value only skips this step: the session is forgotten here either way.
  begin
    v_auth_session := (v_tokens::jsonb ->> 'session_id')::uuid;
  exception when others then
    v_auth_session := null;
  end;
  if v_auth_session is not null then
    delete from auth.sessions where id = v_auth_session and user_id = v_session.user_id;
  end if;
  return v_tokens;
end $$;

revoke all on function bff.end_session(bytea) from public, anon, authenticated;
grant execute on function bff.end_session(bytea) to service_role;
