-- The account menu's "Today" line: card drafts a person can still ask for today, read from the
-- shared daily counters (20261122000100_usage_limits.sql). Never more than everyone's share left.
-- Read only; only the backend can call it.

create function bff.card_drafts_left(p_user uuid) returns integer
language sql security definer set search_path = '' stable as $$
  with v as (
    select p.card_draft_per_user_daily as user_cap,
           p.card_draft_global_daily as global_cap,
           (now() at time zone 'utc')::date as day
    from app_private.policy p
  )
  select greatest(0, least(
    v.user_cap - coalesce((select u.used from app_private.daily_usage u
      where u.day = v.day and u.subject = p_user::text and u.kind = 'card_draft'), 0),
    v.global_cap - coalesce((select u.used from app_private.daily_usage u
      where u.day = v.day and u.subject = 'global' and u.kind = 'card_draft'), 0)
  ))::integer
  from v;
$$;

revoke all on function bff.card_drafts_left(uuid) from public, anon, authenticated;
grant execute on function bff.card_drafts_left(uuid) to service_role;
