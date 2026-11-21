import { CODE_PATTERN, MAX_PASSWORD_BYTES, MIN_PASSWORD } from '../../shared/auth.js';
import { json, readCapped } from './http.js';
import { createRateLimit } from './rateLimit.js';
import {
  clearedSessionCookie,
  createSession,
  currentSession,
  endSession,
  isSameOriginMutation,
  readHandle,
  sessionCookie,
  type SessionDeps,
} from './session.js';
import {
  createSupabase,
  SupabaseError,
  supabaseConfig,
  type AuthTokens,
  type Supabase,
  type SupabaseConfig,
} from './supabase.js';

/**
 * `/api/auth/*`: sign-in held by the backend (D64). Two ways in: an emailed code, or email and
 * password. A password is set or replaced only together with a fresh emailed code, which is also
 * the "forgot password" path, so a stolen session alone can't change it and no reset link ever
 * carries a token through the browser. Responses never carry Supabase tokens; they are
 * `private, no-store`, and nothing here logs emails, codes, passwords or cookies.
 */

const MAX_BODY_BYTES = 1024;
const MAX_EMAIL = 254;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINUTE_MS = 60_000;
/** Per minute: code emails per visitor and per address, then wrong codes or passwords. */
const OTP_PER_VISITOR = 10;
const OTP_PER_EMAIL = 3;
const GUESSES_PER_VISITOR = 10;
const GUESSES_PER_EMAIL = 5;
const NO_STORE = { 'Cache-Control': 'private, no-store' };

export interface AuthHandlerOptions {
  config?: SupabaseConfig;
  supabase?: Supabase;
  now?: () => number;
  wait?: SessionDeps['wait'];
}

type Handler = (request: Request) => Promise<Response>;
type Ready = { config: SupabaseConfig; supabase: Supabase };

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  json(status, body, { ...NO_STORE, ...headers });

function visitor(request: Request): string {
  return request.headers.get('x-real-ip') ?? 'unknown';
}

async function readFields(request: Request): Promise<Record<string, unknown> | undefined> {
  try {
    const body: unknown = JSON.parse(await readCapped(request, MAX_BODY_BYTES));
    return typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function readEmail(fields: Record<string, unknown> | undefined): string | undefined {
  const raw = fields?.email;
  if (typeof raw !== 'string') return undefined;
  const email = raw.trim().toLowerCase();
  return email.length <= MAX_EMAIL && EMAIL.test(email) ? email : undefined;
}

function readCode(fields: Record<string, unknown> | undefined): string | undefined {
  const code = fields?.code;
  return typeof code === 'string' && CODE_PATTERN.test(code) ? code : undefined;
}

/** Any password the sign-in form may send (an old one may predate today's length rule). */
function readPassword(fields: Record<string, unknown> | undefined): string | undefined {
  const password = fields?.password;
  return typeof password === 'string' &&
    password.length > 0 &&
    Buffer.byteLength(password) <= MAX_PASSWORD_BYTES
    ? password
    : undefined;
}

const kindOf = (error: unknown) => (error instanceof SupabaseError ? error.kind : 'unavailable');

export function createAuthHandlers(options: AuthHandlerOptions = {}): {
  otp: Handler;
  verify: Handler;
  password: Handler;
  setPassword: Handler;
  session: Handler;
  logout: Handler;
} {
  const now = options.now ?? Date.now;
  // Config is read per request so a missing variable shows as 503, never as an open door.
  const setup = (): Ready | undefined => {
    const config = options.config ?? supabaseConfig();
    if (!config) return undefined;
    return { config, supabase: options.supabase ?? createSupabase(config) };
  };
  const otpPerVisitor = createRateLimit(OTP_PER_VISITOR, MINUTE_MS, now);
  const otpPerEmail = createRateLimit(OTP_PER_EMAIL, MINUTE_MS, now);
  // Codes and passwords share these, so switching method doesn't buy extra guesses.
  const guessPerVisitor = createRateLimit(GUESSES_PER_VISITOR, MINUTE_MS, now);
  const guessPerEmail = createRateLimit(GUESSES_PER_EMAIL, MINUTE_MS, now);
  const tooManyGuesses = (request: Request, email: string) =>
    !guessPerVisitor(visitor(request)) || !guessPerEmail(email);

  /** Common front door for the POST endpoints: configured and from our own pages. */
  function guard(request: Request): Response | Ready {
    const ready = setup();
    if (!ready) return reply(503, { error: 'not_configured' });
    if (!isSameOriginMutation(request, ready.config)) return reply(403, { error: 'cross_site' });
    return ready;
  }

  /** A new handle on every sign-in; the session it replaces (maybe another account) ends first. */
  async function signIn(request: Request, ready: Ready, tokens: AuthTokens): Promise<Response> {
    const old = readHandle(request);
    if (old) await endSession(ready.supabase, old, now).catch(() => undefined);
    const handle = await createSession(ready.supabase, tokens);
    return reply(
      200,
      { signedIn: true, email: tokens.email },
      { 'Set-Cookie': sessionCookie(handle) },
    );
  }

  function failure(error: unknown, refused: string): Response {
    const kind = kindOf(error);
    if (kind === 'invalid') return reply(401, { error: refused });
    if (kind === 'limited') return reply(429, { error: 'too_many_attempts' });
    return reply(503, { error: 'unavailable' });
  }

  return {
    async otp(request) {
      const ready = guard(request);
      if (ready instanceof Response) return ready;
      const email = readEmail(await readFields(request));
      if (!email) return reply(400, { error: 'bad_email' });
      if (!otpPerVisitor(visitor(request)) || !otpPerEmail(email)) {
        return reply(429, { error: 'too_many_attempts' });
      }
      try {
        await ready.supabase.sendOtp(email);
      } catch (error) {
        // A refusal (e.g. sign-ups closed and no such account) looks like success, so the answer
        // never tells a stranger which emails have accounts.
        const kind = kindOf(error);
        if (kind === 'limited') return reply(429, { error: 'too_many_attempts' });
        if (kind !== 'invalid') return reply(503, { error: 'unavailable' });
      }
      return reply(200, { ok: true });
    },

    async verify(request) {
      const ready = guard(request);
      if (ready instanceof Response) return ready;
      const fields = await readFields(request);
      const email = readEmail(fields);
      const code = readCode(fields);
      if (!email || !code) return reply(400, { error: 'bad_request' });
      if (tooManyGuesses(request, email)) return reply(429, { error: 'too_many_attempts' });
      try {
        return await signIn(request, ready, await ready.supabase.verifyOtp(email, code));
      } catch (error) {
        return failure(error, 'wrong_code');
      }
    },

    /** Email and password. One answer for "no such account" and "wrong password". */
    async password(request) {
      const ready = guard(request);
      if (ready instanceof Response) return ready;
      const fields = await readFields(request);
      const email = readEmail(fields);
      const password = readPassword(fields);
      if (!email || !password) return reply(400, { error: 'bad_request' });
      if (tooManyGuesses(request, email)) return reply(429, { error: 'too_many_attempts' });
      try {
        return await signIn(
          request,
          ready,
          await ready.supabase.signInWithPassword(email, password),
        );
      } catch (error) {
        return failure(error, 'wrong_password');
      }
    },

    /**
     * Sets a new password with a fresh emailed code (first password, change, or forgot). Every
     * other session of that account is signed out, then this browser is signed in.
     */
    async setPassword(request) {
      const ready = guard(request);
      if (ready instanceof Response) return ready;
      const fields = await readFields(request);
      const email = readEmail(fields);
      const code = readCode(fields);
      const password = fields?.password;
      if (!email || !code || typeof password !== 'string')
        return reply(400, { error: 'bad_request' });
      if (password.length < MIN_PASSWORD || Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
        return reply(400, { error: 'weak_password' });
      }
      if (tooManyGuesses(request, email)) return reply(429, { error: 'too_many_attempts' });
      let tokens: AuthTokens;
      try {
        tokens = await ready.supabase.verifyOtp(email, code);
      } catch (error) {
        return failure(error, 'wrong_code');
      }
      // Don't leave the session the code just opened lying about at Supabase on any failure.
      const dropCodeSession = () =>
        ready.supabase.logout(tokens.access_token).catch(() => undefined);
      try {
        // Other sessions go first, so a failure here leaves the old password and nothing changed.
        await ready.supabase.rpc('end_user_sessions', { p_user: tokens.user_id });
      } catch {
        await dropCodeSession();
        return reply(503, { error: 'unavailable' });
      }
      try {
        await ready.supabase.updatePassword(tokens.access_token, password);
      } catch (error) {
        await dropCodeSession();
        const code = error instanceof SupabaseError ? error.code : undefined;
        if (code === 'weak_password') return reply(400, { error: 'weak_password' });
        if (code === 'same_password') return reply(400, { error: 'same_password' });
        if (kindOf(error) === 'limited') return reply(429, { error: 'too_many_attempts' });
        return reply(503, { error: 'unavailable' });
      }
      try {
        return await signIn(request, ready, tokens);
      } catch {
        return reply(503, { error: 'unavailable' });
      }
    },

    async session(request) {
      const ready = setup();
      if (!ready) return reply(503, { error: 'not_configured' });
      const result = await currentSession(request, {
        supabase: ready.supabase,
        now,
        wait: options.wait,
      });
      if (result.kind === 'unavailable') return reply(503, { error: 'unavailable' });
      if (result.kind === 'none') {
        const stale: Record<string, string> = readHandle(request)
          ? { 'Set-Cookie': clearedSessionCookie() }
          : {};
        return reply(200, { signedIn: false }, stale);
      }
      // Either can be missing for a moment (null): the page treats that as "don't know", and the
      // server still checks the permission on every paid call.
      const [quota, widerWeb] = await Promise.all([
        ready.supabase
          .rpc<{ available: number; reserved: number }[]>('quota_of', { p_user: result.userId })
          .then(([row]) => row ?? null)
          .catch(() => null),
        ready.supabase
          .rpc<boolean>('can_search_wider_web', { p_user: result.userId })
          .then((allowed) => allowed === true)
          .catch(() => null),
      ]);
      return reply(200, { signedIn: true, email: result.email, quota, widerWeb });
    },

    async logout(request) {
      const ready = guard(request);
      if (ready instanceof Response) return ready;
      const handle = readHandle(request);
      if (handle) {
        try {
          await endSession(ready.supabase, handle, now);
        } catch {
          // The cookie still goes: this browser is signed out; the stored session expires on its own.
          return reply(503, { error: 'unavailable' }, { 'Set-Cookie': clearedSessionCookie() });
        }
      }
      return reply(200, { signedIn: false }, { 'Set-Cookie': clearedSessionCookie() });
    },
  };
}

/**
 * One function serves every `/api/auth/<action>` path, so all sign-in methods share one set of
 * guess counters (separate route files would each get their own).
 */
export function createAuthRoutes(options: AuthHandlerOptions = {}): {
  GET: Handler;
  POST: Handler;
} {
  const h = createAuthHandlers(options);
  const posts: Record<string, Handler> = {
    otp: h.otp,
    verify: h.verify,
    password: h.password,
    'set-password': h.setPassword,
    logout: h.logout,
  };
  const action = (request: Request) => new URL(request.url).pathname.split('/').pop() ?? '';
  const notFound = () => reply(404, { error: 'not_found' });
  return {
    GET: (request) =>
      action(request) === 'session' ? h.session(request) : Promise.resolve(notFound()),
    POST: (request) => {
      const name = action(request);
      const handler = Object.hasOwn(posts, name) ? posts[name] : undefined;
      return handler ? handler(request) : Promise.resolve(notFound());
    },
  };
}
