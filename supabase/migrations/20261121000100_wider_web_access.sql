-- Wider web search for chosen people (replaces the shared access code, D64).
--
-- The owner turns it on per account with SQL (docs/SUPABASE_SETUP.md, "Turn on wider web search");
-- the server checks it on every wider-web search and card draft. Nobody can see or change this
-- table through the API: only the backend asks, with the user id from the signed-in session.

create table app_private.wider_web_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 200)
);

alter table app_private.wider_web_access enable row level security;
revoke all on app_private.wider_web_access from public, anon, authenticated;

create function bff.can_search_wider_web(p_user uuid) returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from app_private.wider_web_access a where a.user_id = p_user);
$$;

revoke all on function bff.can_search_wider_web(uuid) from public, anon, authenticated;
grant execute on function bff.can_search_wider_web(uuid) to service_role;
