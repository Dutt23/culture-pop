-- Post-commit worker kick (pg_net), private Realtime progress, Cron recovery and retention.
--
-- Two Vault secrets the owner creates by hand (checklist step "Vault"): 'pcd_worker_url' (the
-- curation-worker Edge Function URL) and 'pcd_worker_secret' (a random shared secret the function
-- also has as WORKER_SECRET). No secret value is written in this file.

-- Asks the Edge worker to drain the queue. pg_net sends after the transaction commits, so a rolled
-- back submission never dispatches. The body names no job and carries no user text.
create function app_private.kick_worker() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'pcd_worker_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'pcd_worker_secret';
  if v_url is null or v_secret is null then
    raise warning 'curation worker kick skipped: Vault secrets not set';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('kick', 'curation'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  -- The queue is the source of truth; Cron recovery kicks again. Never fail the user's submission.
  raise warning 'curation worker kick failed: %', sqlstate;
end $$;

create function app_private.kick_on_job_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.kick_worker();
  return null;
end $$;
create trigger curation_jobs_kick after insert on public.curation_jobs
  for each statement execute function app_private.kick_on_job_insert();

-- ---------------------------------------------------------------------------------------------
-- Progress: every status/stage change is broadcast on the owner's private topic 'user:<id>'.
-- Metadata only — never input, result text or error detail.
-- ---------------------------------------------------------------------------------------------
create function app_private.broadcast_job() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.progress_version = old.progress_version and new.status = old.status then
    return null;
  end if;
  perform realtime.send(
    jsonb_build_object(
      'job_id', new.id, 'status', new.status, 'stage', new.stage,
      'version', new.progress_version, 'updated_at', new.updated_at
    ),
    'job',
    'user:' || new.user_id::text,
    true
  );
  return null;
end $$;
create trigger curation_jobs_broadcast after insert or update on public.curation_jobs
  for each row execute function app_private.broadcast_job();

-- Only the topic's own user may receive; nobody may send through the client API.
create policy "own job topic: receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------------------------
-- Cron: recovery only kicks when work is waiting; retention trims payloads and old rows.
-- ---------------------------------------------------------------------------------------------
create function app_private.recover_curation() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  -- A visible message is either never picked up (kick lost) or its lease ran out (worker died).
  if exists (select 1 from pgmq.q_curation_jobs where vt <= now()) then
    perform app_private.kick_worker();
    return true;
  end if;
  return false;
end $$;

create function app_private.purge_curation() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_policy app_private.policy;
begin
  select * into strict v_policy from app_private.policy;
  update public.curation_jobs
    set input = null, result = null, payload_purged_at = now()
    where payload_purged_at is null
      and finished_at < now() - make_interval(days => v_policy.job_payload_days);
  delete from public.curation_jobs
    where finished_at < now() - make_interval(days => v_policy.job_metadata_days);
  delete from app_private.app_sessions
    where expires_at <= now()
       or last_seen_at <= now() - make_interval(days => v_policy.session_idle_days);
  delete from pgmq.a_curation_jobs where archived_at < now() - interval '7 days';
end $$;

revoke all on all functions in schema app_private from public, anon, authenticated;

-- The queue tables hold job ids, and pg_net's request queue briefly holds the worker secret header.
-- Some Supabase versions grant these to the API roles; make sure neither is reachable.
revoke all on all tables in schema pgmq from anon, authenticated;
revoke all on all functions in schema pgmq from public, anon, authenticated;
revoke all on all tables in schema net from anon, authenticated;
revoke all on all functions in schema net from public, anon, authenticated;

select cron.schedule('pcd-recover-curation', '*/5 * * * *', 'select app_private.recover_curation()');
select cron.schedule('pcd-purge-curation', '17 3 * * *', 'select app_private.purge_curation()');
