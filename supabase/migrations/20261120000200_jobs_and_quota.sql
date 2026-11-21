-- Job admission, cancellation and the worker's lease/attempt/finish steps.
--
-- Every function is SECURITY DEFINER with an empty search_path and fully qualified names, so a
-- caller can't swap in their own tables. All of them live in schema bff and only service_role (our
-- backend and the Edge worker) may call them: a user holding a Supabase JWT directly can't submit
-- paid work or skip the backend's input checks and rate limits. The backend passes the user id it
-- verified from the session; ownership checks use that id against the job row.

select pgmq.create('curation_jobs');

create function app_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger curation_jobs_touch before update on public.curation_jobs
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Admission. Locks the user's quota row, so two tabs or two server instances submitting at once
-- are served one after the other: the idempotency check, five-job count and credit check all see
-- the same committed state. Job, reservation, ledger entry and queue message commit together.
-- ---------------------------------------------------------------------------------------------
create function bff.submit_curation_job(
  p_user uuid,
  p_idempotency_key text,
  p_input jsonb,
  p_input_hash text,
  p_prompt_version text
) returns table (job_id uuid, outcome text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_policy app_private.policy;
  v_account app_private.quota_accounts;
  v_existing uuid;
  v_active integer;
  v_today integer;
  v_job uuid;
  v_msg bigint;
begin
  if p_user is null
     or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{8,100}$'
     or p_input_hash is null or p_input_hash !~ '^[0-9a-f]{64}$'
     or p_prompt_version is null or length(p_prompt_version) > 40
     or p_input is null or jsonb_typeof(p_input) <> 'object' or pg_column_size(p_input) > 102400 then
    raise exception 'bad submission' using errcode = '22023';
  end if;
  select * into strict v_policy from app_private.policy;

  insert into app_private.quota_accounts (user_id, available)
    values (p_user, v_policy.starter_credits)
    on conflict (user_id) do nothing;
  if found then
    insert into app_private.quota_ledger (user_id, kind, credits, note)
      values (p_user, 'grant', v_policy.starter_credits, 'starter');
  end if;
  select * into strict v_account from app_private.quota_accounts
    where user_id = p_user for update;

  select j.id into v_existing from public.curation_jobs j
    where j.user_id = p_user and j.idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return query select v_existing, 'existing'::text;
    return;
  end if;

  select count(*) into v_active from public.curation_jobs j
    where j.user_id = p_user and j.status in ('queued', 'running');
  if v_active >= v_policy.max_active_jobs then
    return query select null::uuid, 'job_limit'::text;
    return;
  end if;

  if v_account.available < v_policy.credits_per_job then
    return query select null::uuid, 'no_credits'::text;
    return;
  end if;

  -- Counted from the ledger, which outlives deleted jobs.
  select count(*) into v_today from app_private.quota_ledger l
    where l.kind = 'reserve' and l.created_at >= date_trunc('day', now());
  if v_today >= v_policy.global_daily_job_cap then
    return query select null::uuid, 'busy'::text;
    return;
  end if;

  insert into public.curation_jobs
    (user_id, idempotency_key, input, input_hash, prompt_version, reserved_credits)
    values (p_user, p_idempotency_key, p_input, p_input_hash, p_prompt_version, v_policy.credits_per_job)
    returning id into v_job;

  update app_private.quota_accounts
    set available = available - v_policy.credits_per_job,
        reserved = reserved + v_policy.credits_per_job,
        updated_at = now()
    where user_id = p_user;
  insert into app_private.quota_ledger (user_id, job_id, kind, credits)
    values (p_user, v_job, 'reserve', v_policy.credits_per_job);

  -- Only the job id goes on the queue: no user text in queue rows or dispatch requests.
  select pgmq.send('curation_jobs', jsonb_build_object('job_id', v_job)) into v_msg;
  update public.curation_jobs set queue_msg_id = v_msg where id = v_job;

  return query select v_job, 'created'::text;
end $$;

-- Closes a job's reservation once. The charge is decided here, never by the caller: if any paid
-- provider call was sent (or may have been), the credit is used, whatever the final status —
-- otherwise cancelling right after the AI call would get the work for free. Returns false when
-- the reservation was already closed (a second delivery of the same job).
create function app_private.close_reservation(p_job uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.curation_jobs;
  v_spent integer;
begin
  select * into strict v_job from public.curation_jobs where id = p_job;
  v_spent := case when exists (
      select 1 from app_private.job_attempts a
      where a.job_id = p_job and a.state in ('dispatching', 'accepted', 'succeeded', 'unknown')
    ) then v_job.reserved_credits else 0 end;
  begin
    insert into app_private.quota_ledger (user_id, job_id, kind, credits)
      values (v_job.user_id, p_job, case when v_spent > 0 then 'settle' else 'release' end, v_spent);
  exception when unique_violation then
    return false;
  end;
  update app_private.quota_accounts
    set reserved = reserved - v_job.reserved_credits,
        available = available + (v_job.reserved_credits - v_spent),
        updated_at = now()
    where user_id = v_job.user_id;
  return true;
end $$;

-- The user cancels. A queued job stops now and gets its credit back. A running job is flagged; the
-- worker stops at its next step and finishes it as cancelled (charged if a paid call went out).
create function bff.cancel_curation_job(p_user uuid, p_job uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.curation_jobs;
begin
  select * into v_job from public.curation_jobs
    where id = p_job and user_id = p_user for update;
  if not found then
    return 'not_found';
  end if;
  if v_job.status = 'queued' then
    update public.curation_jobs
      set status = 'cancelled', finished_at = now(), progress_version = progress_version + 1
      where id = p_job;
    perform app_private.close_reservation(p_job);
    return 'cancelled';
  elsif v_job.status = 'running' then
    update public.curation_jobs
      set cancel_requested_at = coalesce(cancel_requested_at, now()),
          progress_version = progress_version + 1
      where id = p_job;
    return 'cancelling';
  end if;
  return 'finished';
end $$;

-- A user's balance, for the account screen. No row = never submitted (starter credits not yet given).
create function bff.quota_of(p_user uuid) returns table (available integer, reserved integer)
language sql security definer set search_path = '' stable as $$
  select q.available, q.reserved from app_private.quota_accounts q where q.user_id = p_user;
$$;

-- ---------------------------------------------------------------------------------------------
-- Worker (Edge Function, service role). Fence = the job's lease generation.
-- ---------------------------------------------------------------------------------------------

-- Reads up to p_batch messages and leases their jobs. Messages for jobs that are finished or gone
-- are archived; jobs leased by another live worker are left to reappear. A running job whose
-- lease ran out after any paid call becomes "unknown" instead of being sent again, and a job
-- delivered more than p_max_deliveries times fails instead of looping forever.
create function bff.claim_jobs(p_worker uuid, p_batch integer, p_lease_seconds integer)
returns table (job_id uuid, fence bigint, msg_id bigint, input jsonb, cancel_requested boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c_max_deliveries constant integer := 5;
  v_msg record;
  v_job public.curation_jobs;
  v_job_id uuid;
begin
  if p_batch not between 1 and 10 or p_lease_seconds not between 10 and 600 then
    raise exception 'bad claim arguments' using errcode = '22023';
  end if;
  for v_msg in select * from pgmq.read('curation_jobs', p_lease_seconds, p_batch) loop
    v_job_id := (v_msg.message ->> 'job_id')::uuid;
    select * into v_job from public.curation_jobs where id = v_job_id for update;
    if not found or v_job.status not in ('queued', 'running') then
      perform pgmq.archive('curation_jobs', v_msg.msg_id);
      continue;
    end if;
    if v_job.status = 'running' and v_job.lease_until > now() then
      continue; -- another worker holds it; the message reappears after its visibility timeout
    end if;
    if v_job.status = 'running' and exists (
      select 1 from app_private.job_attempts a
      where a.job_id = v_job.id and a.state in ('dispatching', 'accepted', 'succeeded', 'unknown')
    ) then
      -- shortcut: a crash after a paid call ends the job rather than resuming from saved attempt
      -- output; resume would need each attempt's result stored. Upgrade if crashes are common.
      update public.curation_jobs
        set status = 'unknown', error_code = 'worker_lost', finished_at = now(),
            lease_owner = null, lease_until = null, progress_version = progress_version + 1
        where id = v_job.id;
      perform app_private.close_reservation(v_job.id);
      perform pgmq.archive('curation_jobs', v_msg.msg_id);
      continue;
    end if;
    if v_msg.read_ct > c_max_deliveries then
      update public.curation_jobs
        set status = 'failed', error_code = 'too_many_deliveries', finished_at = now(),
            lease_owner = null, lease_until = null, progress_version = progress_version + 1
        where id = v_job.id;
      perform app_private.close_reservation(v_job.id);
      perform pgmq.archive('curation_jobs', v_msg.msg_id);
      continue;
    end if;
    update public.curation_jobs
      set status = 'running', stage = coalesce(stage, 'starting'),
          lease_owner = p_worker, lease_until = now() + make_interval(secs => p_lease_seconds),
          fence = curation_jobs.fence + 1, started_at = coalesce(started_at, now()),
          queue_msg_id = v_msg.msg_id, progress_version = progress_version + 1
      where id = v_job.id
      returning * into v_job;
    job_id := v_job.id;
    fence := v_job.fence;
    msg_id := v_msg.msg_id;
    input := v_job.input;
    cancel_requested := v_job.cancel_requested_at is not null;
    return next;
  end loop;
end $$;

-- Keeps the lease and the queue message hidden while the worker is still busy. False = lost it.
create function bff.renew_lease(p_job uuid, p_fence bigint, p_lease_seconds integer)
returns table (renewed boolean, cancel_requested boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.curation_jobs;
  v_seconds integer := least(greatest(p_lease_seconds, 10), 600);
begin
  update public.curation_jobs
    set lease_until = now() + make_interval(secs => v_seconds)
    where id = p_job and fence = p_fence and status = 'running'
    returning * into v_job;
  if not found then
    return query select false, false;
    return;
  end if;
  perform pgmq.set_vt('curation_jobs', v_job.queue_msg_id, v_seconds);
  return query select true, v_job.cancel_requested_at is not null;
end $$;

create function bff.report_stage(p_job uuid, p_fence bigint, p_stage text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.curation_jobs
    set stage = left(p_stage, 40), progress_version = progress_version + 1
    where id = p_job and fence = p_fence and status = 'running';
  return found;
end $$;

-- Written before each paid call. Null = this worker no longer owns the job, or the user asked to
-- cancel: don't send.
create function bff.begin_attempt(
  p_job uuid, p_fence bigint, p_provider text, p_operation text, p_input_hash text,
  p_estimated_cost_micros bigint
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_attempt uuid;
begin
  perform 1 from public.curation_jobs
    where id = p_job and fence = p_fence and status = 'running' and lease_until > now()
      and cancel_requested_at is null
    for update;
  if not found then
    return null;
  end if;
  insert into app_private.job_attempts
    (job_id, fence, provider, operation, input_hash, estimated_cost_micros)
    values (p_job, p_fence, p_provider, p_operation, p_input_hash, p_estimated_cost_micros)
    returning id into v_attempt;
  return v_attempt;
end $$;

create function bff.end_attempt(
  p_attempt uuid, p_state text, p_provider_request_id text, p_actual_cost_micros bigint, p_usage jsonb
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_state not in ('accepted', 'succeeded', 'failed', 'unknown') then
    raise exception 'bad attempt state' using errcode = '22023';
  end if;
  update app_private.job_attempts
    set state = p_state,
        provider_request_id = coalesce(p_provider_request_id, provider_request_id),
        actual_cost_micros = coalesce(p_actual_cost_micros, actual_cost_micros),
        usage = coalesce(p_usage, usage),
        updated_at = now()
    where id = p_attempt and state in ('dispatching', 'accepted');
  return found;
end $$;

-- Result, status, credit settlement and queue acknowledgement in one transaction. False = a newer
-- worker owns the job or it is already finished; the caller must drop its result.
create function bff.finish_job(
  p_job uuid, p_fence bigint, p_status text, p_result jsonb, p_error_code text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.curation_jobs;
begin
  if p_status not in ('completed', 'failed', 'cancelled', 'unknown') then
    raise exception 'bad final status' using errcode = '22023';
  end if;
  update public.curation_jobs
    set status = p_status, result = p_result, error_code = left(p_error_code, 60),
        stage = null, finished_at = now(), lease_owner = null, lease_until = null,
        progress_version = progress_version + 1
    where id = p_job and fence = p_fence and status = 'running'
    returning * into v_job;
  if not found then
    return false;
  end if;
  perform app_private.close_reservation(p_job);
  perform pgmq.archive('curation_jobs', v_job.queue_msg_id);
  return true;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Grants: bff for service_role only; nothing here for anon or signed-in users.
-- ---------------------------------------------------------------------------------------------
revoke all on all functions in schema app_private from public, anon, authenticated;
revoke all on all functions in schema bff from public, anon, authenticated;
grant execute on all functions in schema bff to service_role;
