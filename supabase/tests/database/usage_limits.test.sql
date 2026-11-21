-- pgTAP: shared daily credits, sign-in attempt windows, and logout ending the Supabase session.
-- Concurrency (many calls at once) is checked live: e2e/limits.live.spec.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

update app_private.policy set web_search_per_user_daily = 2, web_search_global_daily = 3,
  guesses_per_email = 2;
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'b@example.test', 'authenticated', 'authenticated');

set local role service_role;
select is(bff.take_web_credit('11111111-1111-4111-8111-111111111111', 'web_search'), 'ok', 'A: first search');
select is(bff.take_web_credit('11111111-1111-4111-8111-111111111111', 'web_search'), 'ok', 'A: second search');
select is(bff.take_web_credit('11111111-1111-4111-8111-111111111111', 'web_search'), 'user_cap',
  'A: third is over the per-person cap');
select is(bff.take_web_credit('22222222-2222-4222-8222-222222222222', 'web_search'), 'ok', 'B: first search');
select is(bff.take_web_credit('22222222-2222-4222-8222-222222222222', 'web_search'), 'global_cap',
  'B: second is over everyone''s cap');
select is(bff.take_web_credit('22222222-2222-4222-8222-222222222222', 'card_draft'), 'ok',
  'card drafts are counted apart from searches');
select throws_ok($$ select bff.take_web_credit(null, 'web_search') $$, '22023', null, 'no user: refused');
select throws_ok($$ select bff.take_web_credit('22222222-2222-4222-8222-222222222222', 'other') $$,
  '22023', null, 'unknown kind: refused');
reset role;
select is((select used from app_private.daily_usage
  where subject = '22222222-2222-4222-8222-222222222222' and kind = 'web_search'), 1,
  'B''s refused search was not counted against B');
select is((select used from app_private.daily_usage where subject = 'global' and kind = 'web_search'), 3,
  'everyone''s count stops at its cap');

set local role service_role;
select is(bff.take_auth_attempt('guess_email', repeat('a', 64)), true, 'attempt 1');
select is(bff.take_auth_attempt('guess_email', repeat('a', 64)), true, 'attempt 2');
select is(bff.take_auth_attempt('guess_email', repeat('a', 64)), false, 'attempt 3 is over the limit');
reset role;
update app_private.auth_attempts set window_start = now() - interval '2 minutes';
set local role service_role;
select is(bff.take_auth_attempt('guess_email', repeat('a', 64)), true, 'a new window starts afresh');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok($$ select bff.take_web_credit(auth.uid(), 'web_search') $$, '42501', null,
  'signed-in user: cannot spend credits directly');
reset role;

-- Logout ends the Supabase session named in the token bundle, and only that user's.
insert into auth.sessions (id, user_id)
  values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111');
set local role service_role;
select bff.create_session(sha256('handle-x'), '11111111-1111-4111-8111-111111111111',
  '{"access_token":"a","refresh_token":"r","expires_at":1,"user_id":"11111111-1111-4111-8111-111111111111","email":"a@example.test","session_id":"33333333-3333-4333-8333-333333333333"}');
select isnt(bff.end_session(sha256('handle-x')), null, 'logout returns the bundle once');
reset role;
select is((select count(*)::int from auth.sessions where id = '33333333-3333-4333-8333-333333333333'), 0,
  'logout deleted the Supabase session');

select * from finish();
rollback;
