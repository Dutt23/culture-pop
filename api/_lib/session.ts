import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CSRF_HEADER } from '../../shared/auth.js';
import { cookieFlags, readCookie } from './cookies.js';
import { isCrossSite, sleep } from './http.js';
import { SupabaseError, type AuthTokens, type Supabase, type SupabaseConfig } from './supabase.js';

/**
 * Backend-held sign-in (D64, docs/SUPABASE_PLAN.md "BFF endpoints and token storage").
 *
 * The browser gets one random handle in an HttpOnly cookie. The database stores only the handle's
 * SHA-256 and keeps the Supabase tokens in Vault. Refresh is serialised per session by a database
 * lease with a version check, so two requests never both spend the same refresh token and a slow
 * request can't overwrite newer tokens. Never log handles, tokens or codes.
 */

export const SESSION_COOKIE = 'pcd_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
/** Refresh this long before the access token runs out. */
const REFRESH_EARLY_SECONDS = 60;
/** Longer than a refresh plus a commit can take (two 10 s timeouts), so a slow refresher keeps it. */
const LEASE_SECONDS = 35;
/** While another request refreshes: how often and how long (12 s) to wait for its result. */
const WAIT_MS = 500;
const MAX_WAITS = 24;
const HANDLE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** An access token closer than this to running out is refreshed before logout uses it. */
const LOGOUT_TOKEN_MARGIN_MS = 5_000;

export interface SessionUser {
  userId: string;
  email: string;
  accessToken: string;
}

export type SessionResult =
  { kind: 'none' } | { kind: 'unavailable' } | ({ kind: 'ok' } & SessionUser);

export interface SessionDeps {
  supabase: Supabase;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
}

export function newHandle(): string {
  return randomBytes(32).toString('base64url');
}

/** PostgREST takes bytea as `\x` + hex. */
export function handleDigest(handle: string): string {
  return `\\x${createHash('sha256').update(handle).digest('hex')}`;
}

/**
 * Flags from `cookies.ts`: HttpOnly, SameSite=Strict, Path=/api
 * (only our functions need it; page loads never send it) and Secure. Secure is dropped only by the
 * local `ACCESS_COOKIE_INSECURE_DEV=1` switch for a phone on plain http, which `devFlags.ts` ignores
 * on every Vercel deployment.
 */
export function sessionCookie(handle: string): string {
  return `${SESSION_COOKIE}=${handle}; ${cookieFlags()}; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; ${cookieFlags()}; Max-Age=0`;
}

/** The handle in the request, only if it has the exact shape we issue. */
export function readHandle(request: Request): string | undefined {
  const handle = readCookie(request, SESSION_COOKIE);
  return handle && HANDLE_PATTERN.test(handle) ? handle : undefined;
}

/**
 * CSRF guard for cookie-authenticated changes. The cookie is SameSite=Strict already; on top of
 * that the request must come from our own pages (Sec-Fetch-Site / Origin) and carry a custom header,
 * which a cross-site form can't send and a cross-site fetch can't send without a CORS preflight we
 * never answer.
 */
export function isSameOriginMutation(request: Request, config: SupabaseConfig): boolean {
  if (isCrossSite(request)) return false;
  const origin = request.headers.get('Origin');
  if (origin !== null && config.appOrigin && origin !== config.appOrigin) return false;
  if (origin === null && request.headers.get('Sec-Fetch-Site') === null) return false;
  return request.headers.get(CSRF_HEADER) === '1';
}

function parseBundle(text: unknown): AuthTokens | undefined {
  if (typeof text !== 'string') return undefined;
  try {
    const b = JSON.parse(text) as Partial<AuthTokens>;
    return typeof b.access_token === 'string' &&
      typeof b.refresh_token === 'string' &&
      typeof b.expires_at === 'number' &&
      typeof b.user_id === 'string' &&
      typeof b.email === 'string'
      ? (b as AuthTokens)
      : undefined;
  } catch {
    return undefined;
  }
}

interface LoadedRow {
  session_id: string;
  user_id: string;
  tokens: string;
  token_version: number;
}
interface LeaseRow {
  acquired: boolean;
  token_version: number;
  tokens: string;
}

/** Starts a session for freshly verified tokens; returns the cookie handle. */
export async function createSession(supabase: Supabase, tokens: AuthTokens): Promise<string> {
  const handle = newHandle();
  await supabase.rpc('create_session', {
    p_handle_digest: handleDigest(handle),
    p_user: tokens.user_id,
    p_tokens: JSON.stringify(tokens),
  });
  return handle;
}

/** Forgets the session and, best effort, ends it at Supabase too. */
export async function endSession(
  supabase: Supabase,
  handle: string,
  now: () => number = Date.now,
): Promise<void> {
  const tokens = parseBundle(
    await supabase.rpc<string | null>('end_session', { p_handle_digest: handleDigest(handle) }),
  );
  if (!tokens) return;
  try {
    // Logout needs a live access token; an idle session's has run out, so refresh it first.
    const access =
      tokens.expires_at * 1000 > now() + LOGOUT_TOKEN_MARGIN_MS
        ? tokens.access_token
        : (await supabase.refresh(tokens.refresh_token)).access_token;
    await supabase.logout(access);
  } catch {
    // Already forgotten here, and bff.end_session deleted the Supabase session named by the
    // bundle's session_id. Only an older bundle without one leaves that row to Supabase.
  }
}

/** Who is signed in, refreshing the Supabase tokens when they are about to run out. */
export async function currentSession(request: Request, deps: SessionDeps): Promise<SessionResult> {
  const { supabase } = deps;
  const now = deps.now ?? Date.now;
  const wait = deps.wait ?? sleep;
  const handle = readHandle(request);
  if (!handle) return { kind: 'none' };
  const digest = handleDigest(handle);
  const fresh = (t: AuthTokens) => t.expires_at - REFRESH_EARLY_SECONDS > now() / 1000;
  const ok = (t: AuthTokens): SessionResult => ({
    kind: 'ok',
    userId: t.user_id,
    email: t.email,
    accessToken: t.access_token,
  });

  try {
    for (let tries = 0; tries <= MAX_WAITS; tries += 1) {
      const [row] = await supabase.rpc<LoadedRow[]>('load_session', { p_handle_digest: digest });
      if (!row) return { kind: 'none' };
      const stored = parseBundle(row.tokens);
      if (!stored || stored.user_id !== row.user_id) {
        await endSession(supabase, handle, now);
        return { kind: 'none' };
      }
      if (fresh(stored)) return ok(stored);

      const owner = randomUUID();
      const [lease] = await supabase.rpc<LeaseRow[]>('acquire_refresh_lease', {
        p_session: row.session_id,
        p_owner: owner,
        p_seconds: LEASE_SECONDS,
      });
      if (!lease) return { kind: 'none' };
      if (!lease.acquired) {
        await wait(WAIT_MS); // another request is refreshing; reload its result
        continue;
      }
      const leased = parseBundle(lease.tokens) ?? stored;
      const release = () =>
        supabase.rpc('release_refresh_lease', { p_session: row.session_id, p_owner: owner });
      if (fresh(leased)) {
        await release();
        return ok(leased);
      }
      let refreshed: AuthTokens;
      try {
        refreshed = await supabase.refresh(leased.refresh_token);
      } catch (error) {
        await release();
        if (error instanceof SupabaseError && error.kind === 'invalid') {
          // Revoked, reused or expired at Supabase: sign out here too.
          await endSession(supabase, handle, now);
          return { kind: 'none' };
        }
        // No clear answer: keep the session, don't guess, ask the browser to try again.
        return { kind: 'unavailable' };
      }
      if (refreshed.user_id !== row.user_id) {
        await endSession(supabase, handle, now);
        return { kind: 'none' };
      }
      // The old refresh token is spent now, so losing these tokens would sign the user out at the
      // next refresh: retry the save once if it gets no clear answer. The database refuses it only
      // if someone saved newer tokens (version check), and then those are the ones to keep.
      const commit = () =>
        supabase.rpc<boolean>('commit_refresh', {
          p_session: row.session_id,
          p_owner: owner,
          p_expected_version: lease.token_version,
          p_tokens: JSON.stringify(refreshed),
        });
      await commit().catch(commit);
      return ok(refreshed);
    }
    return { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}
