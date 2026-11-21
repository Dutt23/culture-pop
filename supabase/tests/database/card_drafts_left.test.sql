-- pgTAP: card drafts left today, from the shared daily counters.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Start from no usage today (rolled back with the rest).
delete from app_private.daily_usage;
update app_private.policy set card_draft_per_user_daily = 3, card_draft_global_daily = 4;
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'b@example.test', 'authenticated', 'authenticated');

set local role service_role;
select is(bff.card_drafts_left('11111111-1111-4111-8111-111111111111'), 3, 'nothing used: the full cap');
select bff.take_web_credit('11111111-1111-4111-8111-111111111111', 'card_draft');
select bff.take_web_credit('11111111-1111-4111-8111-111111111111', 'web_search');
select is(bff.card_drafts_left('11111111-1111-4111-8111-111111111111'), 2,
  'one draft used; searches do not count');
select bff.take_web_credit('22222222-2222-4222-8222-222222222222', 'card_draft');
select bff.take_web_credit('22222222-2222-4222-8222-222222222222', 'card_draft');
select is(bff.card_drafts_left('11111111-1111-4111-8111-111111111111'), 1,
  'never more than everyone''s share left');
select bff.take_web_credit('22222222-2222-4222-8222-222222222222', 'card_draft');
select is(bff.card_drafts_left('11111111-1111-4111-8111-111111111111'), 0, 'everyone''s cap used: none left');
reset role;

set local role authenticated;
select throws_ok($$ select bff.card_drafts_left('11111111-1111-4111-8111-111111111111') $$, '42501', null,
  'signed-in user: cannot call it directly');
reset role;

select * from finish();
rollback;
