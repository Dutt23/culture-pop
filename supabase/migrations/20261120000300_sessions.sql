-- Backend-held sessions (SUPABASE_PLAN.md "BFF endpoints and token storage").
--
-- The browser holds only a random handle in an HttpOnly cookie. The backend stores its SHA-256
-- digest here and keeps the Supabase access/refresh token bundle encrypted in Vault. Only
-- service_role can call these functions; nothing in this file is reachable with a user's JWT.

alter table app_private.policy
  add column session_idle_days integer not null default 14 check (session_idle_days between 1 and 90),
  add column session_max_days integer not null default 30 check (session_max_days between 1 and 365);

-- Deleting a session row (logout, expiry, account deletion cascade) also deletes its Vault secret.
create function app_private.drop_session_secret() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.vault_secret_id;
  return old;
end $$;
create trigger app_sessions_drop_secret after delete on app_private.app_sessions
  for each row execute function app_private.drop_session_secret();

create function bff.create_session(p_handle_digest bytea, p_user uuid, p_tokens text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_policy app_private.policy;
  v_secret uuid;
  v_session uuid;
begin
  select * into strict v_policy from app_private.policy;
  -- At most 20 live sessions per user: the oldest go first (their Vault secrets with them).
  delete from app_private.app_sessions
    where id in (
      select s.id from app_private.app_sessions s where s.user_id = p_user
      order by s.last_seen_at desc offset 19
    );
  v_secret := vault.create_secret(p_tokens);
  insert into app_private.app_sessions (handle_digest, user_id, vault_secret_id, expires_at)
    values (p_handle_digest, p_user, v_secret, now() + make_interval(days => v_policy.session_max_days))
    returning id into v_session;
  return v_session;
end $$;

-- A live session for this handle, or no row. Expired or idle sessions are deleted on sight.
create function bff.load_session(p_handle_digest bytea)
returns table (session_id uuid, user_id uuid, tokens text, token_version bigint, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_policy app_private.policy;
  v_session app_private.app_sessions;
begin
  select * into strict v_policy from app_private.policy;
  select * into v_session from app_private.app_sessions s where s.handle_digest = p_handle_digest;
  if not found then
    return;
  end if;
  if v_session.expires_at <= now()
     or v_session.last_seen_at + make_interval(days => v_policy.session_idle_days) <= now() then
    delete from app_private.app_sessions s where s.id = v_session.id;
    return;
  end if;
  update app_private.app_sessions s set last_seen_at = now()
    where s.id = v_session.id and s.last_seen_at < now() - interval '5 minutes';
  return query
    select v_session.id, v_session.user_id, d.decrypted_secret, v_session.token_version, v_session.expires_at
    from vault.decrypted_secrets d where d.id = v_session.vault_secret_id;
end $$;

-- One refresher per session at a time. Returns the current bundle and version either way, so a
-- caller that didn't get the lease can wait and reload instead of refreshing with an old token.
create function bff.acquire_refresh_lease(p_session uuid, p_owner uuid, p_seconds integer)
returns table (acquired boolean, token_version bigint, tokens text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_policy app_private.policy;
  v_session app_private.app_sessions;
  v_acquired boolean := false;
begin
  select * into strict v_policy from app_private.policy;
  select * into v_session from app_private.app_sessions s
    where s.id = p_session and s.expires_at > now()
      and s.last_seen_at + make_interval(days => v_policy.session_idle_days) > now()
    for update;
  if not found then
    return;
  end if;
  if v_session.refresh_lease_until is null or v_session.refresh_lease_until <= now()
     or v_session.refresh_lease_owner = p_owner then
    update app_private.app_sessions s
      set refresh_lease_owner = p_owner,
          refresh_lease_until = now() + make_interval(secs => least(greatest(p_seconds, 5), 60))
      where s.id = p_session;
    v_acquired := true;
  end if;
  return query
    select v_acquired, v_session.token_version, d.decrypted_secret
    from vault.decrypted_secrets d where d.id = v_session.vault_secret_id;
end $$;

-- Saves a refreshed bundle unless someone saved a newer one. p_owner only clears a lease it holds.
create function bff.commit_refresh(p_session uuid, p_owner uuid, p_expected_version bigint, p_tokens text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_session app_private.app_sessions;
begin
  -- Fenced on the version only: a refresher whose lease ran out has already spent the old refresh
  -- token, so its tokens must still be saved unless someone saved newer ones.
  select * into v_session from app_private.app_sessions
    where id = p_session and token_version = p_expected_version
    for update;
  if not found then
    return false;
  end if;
  perform vault.update_secret(v_session.vault_secret_id, p_tokens);
  update app_private.app_sessions
    set token_version = token_version + 1,
        refresh_lease_owner = case when refresh_lease_owner = p_owner then null else refresh_lease_owner end,
        refresh_lease_until = case when refresh_lease_owner = p_owner then null else refresh_lease_until end
    where id = p_session;
  return true;
end $$;

create function bff.release_refresh_lease(p_session uuid, p_owner uuid) returns void
language sql security definer set search_path = '' as $$
  update app_private.app_sessions
    set refresh_lease_owner = null, refresh_lease_until = null
    where id = p_session and refresh_lease_owner = p_owner;
$$;

-- New cookie handle for the same session (after login and sensitive changes).
create function bff.rotate_session_handle(p_old_digest bytea, p_new_digest bytea) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update app_private.app_sessions set handle_digest = p_new_digest
    where handle_digest = p_old_digest and expires_at > now();
  return found;
end $$;

-- Logout. Returns the bundle once so the backend can revoke the Supabase session, then forgets it.
create function bff.end_session(p_handle_digest bytea) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_session app_private.app_sessions;
  v_tokens text;
begin
  select * into v_session from app_private.app_sessions
    where handle_digest = p_handle_digest for update;
  if not found then
    return null;
  end if;
  select d.decrypted_secret into v_tokens from vault.decrypted_secrets d
    where d.id = v_session.vault_secret_id;
  delete from app_private.app_sessions where id = v_session.id;
  return v_tokens;
end $$;

-- "Sign out everywhere" for one user.
create function bff.end_user_sessions(p_user uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  delete from app_private.app_sessions where user_id = p_user;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on all functions in schema app_private from public, anon, authenticated;
revoke all on all functions in schema bff from public, anon, authenticated;
grant execute on all functions in schema bff to service_role;
