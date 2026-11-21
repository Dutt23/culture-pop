-- pgTAP: wider web search is on only for people the owner chose, and only the backend can ask.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'chosen@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'other@example.test', 'authenticated', 'authenticated');
insert into app_private.wider_web_access (user_id, note)
  values ('11111111-1111-4111-8111-111111111111', 'pilot');

set local role service_role;
select is(bff.can_search_wider_web('11111111-1111-4111-8111-111111111111'), true, 'chosen person: allowed');
select is(bff.can_search_wider_web('22222222-2222-4222-8222-222222222222'), false, 'anyone else: not allowed');
select is(bff.can_search_wider_web(null), false, 'no user: not allowed');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select throws_ok($$ select bff.can_search_wider_web(auth.uid()) $$, '42501', null, 'signed-in user: cannot ask directly');
select throws_ok($$ insert into app_private.wider_web_access (user_id) values (auth.uid()) $$, '42501', null,
  'signed-in user: cannot grant themself');
reset role;

set local role anon;
select throws_ok($$ select * from app_private.wider_web_access $$, '42501', null, 'anon: cannot read who is allowed');
reset role;

delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::int from app_private.wider_web_access), 0, 'deleting the account removes the permission');

select * from finish();
rollback;
