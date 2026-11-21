-- pgTAP: who can see and do what. Run locally with `supabase test db` (needs Docker).
-- Covers anonymous, owner, other user and service role ("admin"), quota/job admission, worker
-- fencing, charging rules, Realtime topic isolation, sessions and account-deletion cleanup.
-- Not covered here: two connections racing (one pgTAP file is one transaction); see
-- docs/SUPABASE_SETUP.md, "Race check".

begin;
create extension if not exists pgtap with schema extensions;
select plan(68);

-- Fixtures (rolled back at the end) -------------------------------------------------------------
create schema t;
grant usage on schema t to anon, authenticated, service_role;
grant create on schema t to service_role;
alter default privileges in schema t grant select on tables to anon, authenticated, service_role;

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'owner@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'other@example.test', 'authenticated', 'authenticated');

create function t.as_user(p uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;
create function t.submit(p_user uuid, p_key text) returns text language sql as $$
  select outcome from bff.submit_curation_job(p_user, p_key, '{"title":"x"}', repeat('a', 64), 'card-draft-v8');
$$;

-- Nothing internal is reachable by the API roles --------------------------------------------------
select ok(not exists (
  select 1 from pg_tables where schemaname = 'pgmq' and (
    has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'select')
    or has_table_privilege('authenticated', format('%I.%I', schemaname, tablename), 'select'))),
  'grants: queue tables closed to anon and signed-in users');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('pgmq', 'net', 'bff', 'app_private') and (
    has_function_privilege('anon', p.oid, 'execute')
    or has_function_privilege('authenticated', p.oid, 'execute'))),
  'grants: queue, pg_net, bff and private functions closed to anon and signed-in users');
select ok(not exists (
  select 1 from pg_tables where schemaname = 'net' and (
    has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'select')
    or has_table_privilege('authenticated', format('%I.%I', schemaname, tablename), 'select'))),
  'grants: pg_net request queue (holds the worker secret header) closed');
select ok(not has_table_privilege('authenticated', 'public.curation_jobs', 'insert,update,delete'),
  'grants: signed-in users can only read jobs');

-- Anonymous ------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.curation_jobs $$, '42501', null, 'anon: cannot read jobs');
select throws_ok($$ select * from public.cards $$, '42501', null, 'anon: cannot read cards');
select throws_ok($$ select t.submit('11111111-1111-4111-8111-111111111111', 'anon-key-0001') $$, '42501', null,
  'anon: cannot submit');
select throws_ok($$ select * from bff.load_session('\x00'::bytea) $$, '42501', null, 'anon: cannot load sessions');
reset role;

-- Signed-in user calling Supabase directly (bypassing our backend) --------------------------------
select t.as_user('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select t.submit(auth.uid(), 'direct-key-001') $$, '42501', null, 'owner: cannot submit around the backend');
select throws_ok($$ insert into public.curation_jobs (user_id, idempotency_key, input_hash, prompt_version, reserved_credits)
  values (auth.uid(), 'direct-insert-01', repeat('a', 64), 'v', 0) $$, '42501', null, 'owner: no direct job insert');
select throws_ok($$ update public.curation_jobs set status = 'completed' $$, '42501', null, 'owner: no direct status change');
select throws_ok($$ delete from public.curation_jobs $$, '42501', null, 'owner: cannot delete job history');
select throws_ok($$ select * from app_private.quota_accounts $$, '42501', null, 'owner: no private quota table');
select throws_ok($$ select * from app_private.app_sessions $$, '42501', null, 'owner: no sessions table');
select throws_ok($$ select * from bff.claim_jobs(gen_random_uuid(), 1, 60) $$, '42501', null, 'owner: no worker functions');
select throws_ok($$ select * from vault.decrypted_secrets $$, '42501', null, 'owner: cannot read Vault');
reset role;

-- Backend submits for the owner: admission, idempotency, five-job limit ---------------------------
set local role service_role;
select is(t.submit('11111111-1111-4111-8111-111111111111', 'owner-key-0001'), 'created', 'owner: first submission is created');
select is(t.submit('11111111-1111-4111-8111-111111111111', 'owner-key-0001'), 'existing', 'owner: same key returns the existing job');
select is(t.submit('11111111-1111-4111-8111-111111111111', 'owner-key-0002'), 'created', 'owner: job 2');
select is(t.submit('11111111-1111-4111-8111-111111111111', 'owner-key-0003'), 'created', 'owner: job 3');
select is(t.submit('11111111-1111-4111-8111-111111111111', 'owner-key-0004'), 'created', 'owner: job 4');
select is(t.submit('11111111-1111-4111-8111-111111111111', 'owner-key-0005'), 'created', 'owner: job 5');
select is(t.submit('11111111-1111-4111-8111-111111111111', 'owner-key-0006'), 'job_limit', 'owner: sixth active job is refused');
select results_eq($$ select available, reserved from bff.quota_of('11111111-1111-4111-8111-111111111111') $$,
  $$ values (5, 5) $$, 'owner: five credits held, five left');
select throws_ok($$ select t.submit('11111111-1111-4111-8111-111111111111', 'bad key!') $$, '22023', null,
  'malformed idempotency key refused');
select throws_ok($$ select t.submit(null, 'no-user-key-01') $$, '22023', null, 'submission without a user refused');
reset role;
select t.as_user('11111111-1111-4111-8111-111111111111');
select is((select count(*)::int from public.curation_jobs), 5, 'owner: reads own five jobs');
reset role;

-- Other user -----------------------------------------------------------------------------------
create table t.owner_job as select id from public.curation_jobs order by id limit 1;
update app_private.policy set starter_credits = 0;
select t.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::int from public.curation_jobs), 0, 'other: sees none of the owner''s jobs');
reset role;
set local role service_role;
select is(bff.cancel_curation_job('22222222-2222-4222-8222-222222222222', (select id from t.owner_job)), 'not_found',
  'other: cannot cancel the owner''s job');
select is(t.submit('22222222-2222-4222-8222-222222222222', 'other-key-0001'), 'no_credits', 'other: no credits, no job');
select results_eq($$ select available, reserved from bff.quota_of('22222222-2222-4222-8222-222222222222') $$,
  $$ values (0, 0) $$, 'other: own empty balance only');
reset role;
select is((select count(*)::int from public.curation_jobs where status = 'queued'), 5, 'owner''s jobs untouched');

-- Service role (admin), worker fencing and charging ----------------------------------------------
set local role service_role;
select is((select count(*)::int from public.curation_jobs), 5, 'service role: sees all jobs');
create table t.claimed as select * from bff.claim_jobs('33333333-3333-4333-8333-333333333333', 10, 60);
select is((select count(*)::int from t.claimed), 5, 'worker: claims the five queued jobs');
create table t.j1 as select job_id, fence from t.claimed order by job_id limit 1;
create table t.j2 as select job_id, fence from t.claimed order by job_id offset 1 limit 1;
create table t.j3 as select job_id, fence from t.claimed order by job_id offset 2 limit 1;
grant select on t.j1, t.j2, t.j3 to authenticated;
select is((select count(*)::int from bff.claim_jobs('66666666-6666-4666-8666-666666666666', 10, 60)), 0,
  'worker: a second worker gets nothing while leases are live');

-- j1: paid call, completed, charged once
select is(bff.finish_job((select job_id from t.j1), (select fence from t.j1) - 1, 'completed', '{}', null),
  false, 'worker: stale fence cannot finish');
select is(bff.begin_attempt((select job_id from t.j1), 999, 'openai', 'draft', repeat('b', 64), 1000),
  null, 'worker: stale fence cannot start a paid attempt');
select isnt(bff.begin_attempt((select job_id from t.j1), (select fence from t.j1), 'openai', 'draft', repeat('b', 64), 1000),
  null, 'worker: current fence records an attempt');
select is(bff.finish_job((select job_id from t.j1), (select fence from t.j1), 'completed', '{"title":"t"}', null),
  true, 'worker: finishes once');
select is(bff.finish_job((select job_id from t.j1), (select fence from t.j1), 'completed', '{"title":"t"}', null),
  false, 'worker: second finish is refused');

-- j2: cancelled before any paid call -> no new paid call allowed, credit returned
select is(bff.cancel_curation_job('11111111-1111-4111-8111-111111111111', (select job_id from t.j2)), 'cancelling',
  'owner: cancels a running job');
select is(bff.begin_attempt((select job_id from t.j2), (select fence from t.j2), 'openai', 'draft', repeat('b', 64), 1000),
  null, 'worker: no paid call after cancel');
select is(bff.finish_job((select job_id from t.j2), (select fence from t.j2), 'cancelled', null, 'cancelled'),
  true, 'worker: finishes the cancelled job');

-- j3: cancelled after a paid call -> still charged
select isnt(bff.begin_attempt((select job_id from t.j3), (select fence from t.j3), 'parallel', 'extract', repeat('c', 64), 10000),
  null, 'worker: paid call on job 3');
select is(bff.cancel_curation_job('11111111-1111-4111-8111-111111111111', (select job_id from t.j3)), 'cancelling',
  'owner: cancels job 3 after the paid call');
select is(bff.finish_job((select job_id from t.j3), (select fence from t.j3), 'cancelled', null, 'cancelled'),
  true, 'worker: finishes job 3 as cancelled');
reset role;

select is((select kind from app_private.quota_ledger where job_id = (select job_id from t.j1) and kind <> 'reserve'),
  'settle', 'ledger: completed job is charged');
select is((select count(*)::int from app_private.quota_ledger
  where job_id = (select job_id from t.j1) and kind in ('settle', 'release')), 1, 'ledger: exactly one settlement');
select is((select kind from app_private.quota_ledger where job_id = (select job_id from t.j2) and kind <> 'reserve'),
  'release', 'ledger: cancelled before paying is refunded');
select is((select kind from app_private.quota_ledger where job_id = (select job_id from t.j3) and kind <> 'reserve'),
  'settle', 'ledger: cancelled after paying is still charged');
select results_eq(
  $$ select available, reserved from app_private.quota_accounts where user_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values (6, 2) $$, 'quota: two charged, one refunded, two still held');

-- Keep a card from a completed job --------------------------------------------------------------
select t.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok(format($$ insert into public.cards (source_job_id, card) values (%L, '{}') $$, (select job_id from t.j1)),
  '42501', null, 'other: cannot keep the owner''s card');
reset role;
select t.as_user('11111111-1111-4111-8111-111111111111');
select throws_ok(format($$ insert into public.cards (source_job_id, card) values (%L, '{}') $$, (select job_id from t.j2)),
  '42501', null, 'owner: cannot keep a card from a job that did not complete');
select lives_ok(format($$ insert into public.cards (source_job_id, card) values (%L, '{"title":"t"}') $$, (select job_id from t.j1)),
  'owner: keeps the completed card');
select throws_ok(format($$ insert into public.cards (source_job_id, card) values (%L, '{"title":"t"}') $$, (select job_id from t.j1)),
  '23505', null, 'owner: keeping twice is refused');
reset role;

-- Realtime: a user receives only their own topic ------------------------------------------------
select t.as_user('22222222-2222-4222-8222-222222222222');
select set_config('realtime.topic', 'user:11111111-1111-4111-8111-111111111111', true);
select is((select count(*)::int from realtime.messages), 0, 'realtime: other user gets nothing on the owner''s topic');
reset role;
select t.as_user('11111111-1111-4111-8111-111111111111');
-- If this one fails on a fresh local stack, check that realtime.send could write (a missing daily
-- partition shows as a WARNING in the log) before suspecting the policy.
select ok((select count(*) from realtime.messages) > 0, 'realtime: owner receives own job events');
reset role;

-- Sessions -------------------------------------------------------------------------------------
set local role service_role;
create table t.s as
  select bff.create_session(sha256('handle-1'), '11111111-1111-4111-8111-111111111111', 'bundle-v1') as id;
select is((select tokens from bff.load_session(sha256('handle-1'))), 'bundle-v1', 'session: loads its bundle');
select is((select acquired from bff.acquire_refresh_lease((select id from t.s), '44444444-4444-4444-8444-444444444444', 30)),
  true, 'session: first refresher gets the lease');
select is((select acquired from bff.acquire_refresh_lease((select id from t.s), '55555555-5555-4555-8555-555555555555', 30)),
  false, 'session: second refresher waits');
select is(bff.commit_refresh((select id from t.s), '44444444-4444-4444-8444-444444444444', 0, 'bundle-v2'),
  false, 'session: wrong version cannot commit');
select is(bff.commit_refresh((select id from t.s), '44444444-4444-4444-8444-444444444444', 1, 'bundle-v2'),
  true, 'session: lease holder commits the refreshed bundle');
select is((select tokens from bff.load_session(sha256('handle-1'))), 'bundle-v2', 'session: new bundle is loaded');
reset role;
update app_private.app_sessions set last_seen_at = now() - interval '15 days' where id = (select id from t.s);
set local role service_role;
select is((select count(*)::int from bff.acquire_refresh_lease((select id from t.s), '44444444-4444-4444-8444-444444444444', 30)),
  0, 'session: an idle session cannot be refreshed');
select is((select count(*)::int from bff.load_session(sha256('handle-1'))), 0, 'session: an idle session is not loaded');
select ok(bff.create_session(sha256('handle-2'), '11111111-1111-4111-8111-111111111111', 'bundle-x') is not null,
  'session: a new session can be created');
reset role;

-- Account deletion removes sessions and their Vault secrets -------------------------------------
create table t.secret_ids as
  select vault_secret_id from app_private.app_sessions where user_id = '11111111-1111-4111-8111-111111111111';
delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::int from app_private.app_sessions), 0, 'delete account: sessions gone');
select is((select count(*)::int from vault.secrets where id in (select vault_secret_id from t.secret_ids)), 0,
  'delete account: Vault secrets gone');

select * from finish();
rollback;
