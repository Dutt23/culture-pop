// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthHandlers, createAuthRoutes } from './_lib/authHandlers';
import { handleDigest, SESSION_COOKIE } from './_lib/session';
import {
  SupabaseError,
  type AuthTokens,
  type Supabase,
  type SupabaseConfig,
} from './_lib/supabase';

const ORIGIN = 'https://app.example.test';
const NOW = Date.parse('2026-11-20T12:00:00Z');
const NOW_S = NOW / 1000;
const USER = '11111111-1111-4111-8111-111111111111';
const CONFIG: SupabaseConfig = {
  url: 'https://proj.supabase.test',
  publishableKey: 'sb_publishable_test',
  secretKey: 'sb_secret_test',
  appOrigin: ORIGIN,
};

function tokens(n: number, expiresInS = 3600, userId = USER): AuthTokens {
  return {
    access_token: `access-${n}`,
    refresh_token: `refresh-${n}`,
    expires_at: NOW_S + expiresInS,
    user_id: userId,
    email: 'reader@example.test',
  };
}

interface Row {
  id: string;
  user_id: string;
  tokens: string;
  version: number;
  leaseOwner: string | null;
}

/** In-memory stand-in for the bff session functions and Supabase Auth. */
function fakeSupabase() {
  const sessions = new Map<string, Row>();
  let nextId = 1;
  let refreshCount = 1;
  const byId = (id: string) => [...sessions.values()].find((r) => r.id === id);
  const supabase = {
    sendOtp: vi.fn<Supabase['sendOtp']>(async () => {}),
    verifyOtp: vi.fn(async (_email: string, code: string) => {
      if (code !== '123456') throw new SupabaseError('invalid', 403);
      return tokens(1);
    }),
    signInWithPassword: vi.fn(async (_email: string, password: string) => {
      // Supabase gives one answer for "no such account" and "wrong password".
      if (password !== 'correct horse battery') throw new SupabaseError('invalid', 400);
      return tokens(1);
    }),
    updatePassword: vi.fn<Supabase['updatePassword']>(async () => {}),
    refresh: vi.fn<Supabase['refresh']>(async () => tokens((refreshCount += 1))),
    logout: vi.fn<Supabase['logout']>(async () => {}),
    rpc: vi.fn(async (fn: string, a: Record<string, unknown>): Promise<unknown> => {
      switch (fn) {
        case 'create_session': {
          const id = `s${nextId++}`;
          sessions.set(a.p_handle_digest as string, {
            id,
            user_id: a.p_user as string,
            tokens: a.p_tokens as string,
            version: 1,
            leaseOwner: null,
          });
          return id;
        }
        case 'load_session': {
          const r = sessions.get(a.p_handle_digest as string);
          return r
            ? [{ session_id: r.id, user_id: r.user_id, tokens: r.tokens, token_version: r.version }]
            : [];
        }
        case 'acquire_refresh_lease': {
          const r = byId(a.p_session as string);
          if (!r) return [];
          const acquired = r.leaseOwner === null || r.leaseOwner === a.p_owner;
          if (acquired) r.leaseOwner = a.p_owner as string;
          return [{ acquired, token_version: r.version, tokens: r.tokens }];
        }
        case 'commit_refresh': {
          const r = byId(a.p_session as string);
          if (!r || r.version !== a.p_expected_version) return false;
          r.tokens = a.p_tokens as string;
          r.version += 1;
          if (r.leaseOwner === a.p_owner) r.leaseOwner = null;
          return true;
        }
        case 'release_refresh_lease': {
          const r = byId(a.p_session as string);
          if (r && r.leaseOwner === a.p_owner) r.leaseOwner = null;
          return null;
        }
        case 'end_session': {
          const r = sessions.get(a.p_handle_digest as string);
          sessions.delete(a.p_handle_digest as string);
          return r ? r.tokens : null;
        }
        case 'end_user_sessions': {
          let ended = 0;
          for (const [digest, r] of sessions) {
            if (r.user_id === a.p_user) {
              sessions.delete(digest);
              ended += 1;
            }
          }
          return ended;
        }
        case 'quota_of':
          return [{ available: 7, reserved: 1 }];
        case 'can_search_wider_web':
          return a.p_user === USER;
        default:
          throw new Error(`unexpected rpc ${fn}`);
      }
    }),
  };
  return { supabase: supabase as Supabase & typeof supabase, sessions };
}

function setup(overrides: { wait?: (ms: number) => Promise<void> } = {}) {
  const fake = fakeSupabase();
  const handlers = createAuthHandlers({
    config: CONFIG,
    supabase: fake.supabase,
    now: () => NOW,
    wait: overrides.wait ?? (async () => {}),
  });
  return { ...fake, ...handlers };
}

const sameOrigin = { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin', 'X-PCD-Request': '1' };

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sameOrigin, ...headers },
    body: JSON.stringify(body),
  });
}

function get(cookie?: string): Request {
  return new Request(`${ORIGIN}/api/auth/session`, {
    headers: cookie ? { Cookie: `${SESSION_COOKIE}=${cookie}` } : {},
  });
}

function handleFrom(response: Response): string {
  const match = /pcd_session=([^;]*)/.exec(response.headers.get('Set-Cookie') ?? '');
  if (!match?.[1]) throw new Error('no session cookie');
  return match[1];
}

async function signIn(s: ReturnType<typeof setup>): Promise<string> {
  return handleFrom(
    await s.verify(post('verify', { email: 'Reader@Example.test', code: '123456' })),
  );
}

/** Makes the stored access token look expired. */
function expire(s: ReturnType<typeof setup>, handle: string): void {
  const row = s.sessions.get(handleDigest(handle));
  if (!row) throw new Error('no session');
  row.tokens = JSON.stringify(tokens(1, -10));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('cross-site protection on cookie-authenticated changes', () => {
  it.each([
    ['another site', { 'Sec-Fetch-Site': 'cross-site' }],
    ['another origin', { Origin: 'https://evil.example.test' }],
    ['no custom header', { 'X-PCD-Request': '' }],
  ])('refuses a request from %s', async (_name, headers) => {
    const s = setup();
    for (const [path, handler] of [
      ['otp', s.otp],
      ['verify', s.verify],
      ['logout', s.logout],
      ['password', s.password],
      ['set-password', s.setPassword],
    ] as const) {
      const response = await handler(post(path, { email: 'a@b.test', code: '123456' }, headers));
      expect(response.status).toBe(403);
      expect(response.headers.get('Set-Cookie')).toBeNull();
    }
    expect(s.supabase.sendOtp).not.toHaveBeenCalled();
    expect(s.supabase.verifyOtp).not.toHaveBeenCalled();
  });

  it('refuses a request with neither Origin nor Sec-Fetch-Site', async () => {
    const s = setup();
    const response = await s.otp(
      new Request(`${ORIGIN}/api/auth/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PCD-Request': '1' },
        body: JSON.stringify({ email: 'a@b.test' }),
      }),
    );
    expect(response.status).toBe(403);
  });
});

describe('POST /api/auth/otp', () => {
  it('answers the same whether Supabase sends a code or refuses the email', async () => {
    const s = setup();
    const sent = await s.otp(post('otp', { email: 'a@b.test' }));
    s.supabase.sendOtp.mockRejectedValueOnce(new SupabaseError('invalid', 422));
    const refused = await s.otp(post('otp', { email: 'c@d.test' }));
    expect([sent.status, refused.status]).toEqual([200, 200]);
    expect(await refused.json()).toEqual(await sent.json());
    expect(sent.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('says unavailable, not "sent", when Supabase gives no clear answer', async () => {
    const s = setup();
    s.supabase.sendOtp.mockRejectedValueOnce(new SupabaseError('unavailable', 0));
    expect((await s.otp(post('otp', { email: 'a@b.test' }))).status).toBe(503);
  });

  it('passes on Supabase\'s "wait a minute" as a rate limit, not an outage', async () => {
    const s = setup();
    s.supabase.sendOtp.mockRejectedValueOnce(new SupabaseError('limited', 429));
    expect((await s.otp(post('otp', { email: 'a@b.test' }))).status).toBe(429);
  });

  it('refuses a malformed email before calling Supabase', async () => {
    const s = setup();
    for (const email of ['', 'no-at-sign', 'a@b', `${'x'.repeat(250)}@b.test`, 42]) {
      expect((await s.otp(post('otp', { email }))).status).toBe(400);
    }
    expect(s.supabase.sendOtp).not.toHaveBeenCalled();
  });

  it('limits codes per email to three a minute, however the email is written', async () => {
    const s = setup();
    for (const email of ['a@b.test', 'A@B.test', ' a@b.test ']) {
      expect((await s.otp(post('otp', { email }))).status).toBe(200);
    }
    expect((await s.otp(post('otp', { email: 'a@b.test' }))).status).toBe(429);
    expect(s.supabase.sendOtp).toHaveBeenCalledTimes(3);
  });

  it('is closed when Supabase is not configured', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    const response = await createAuthHandlers().otp(post('otp', { email: 'a@b.test' }));
    expect(response.status).toBe(503);
  });
});

describe('POST /api/auth/verify', () => {
  it('starts a session with an HttpOnly, Secure, SameSite=Strict cookie and no tokens in the reply', async () => {
    const s = setup();
    const response = await s.verify(
      post('verify', { email: 'Reader@Example.test', code: '123456' }),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers.get('Set-Cookie') ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api/);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const text = await response.text();
    expect(text).not.toMatch(/access-|refresh-/);
    expect(JSON.parse(text)).toEqual({ signedIn: true, email: 'reader@example.test' });
    expect(s.supabase.verifyOtp).toHaveBeenCalledWith('reader@example.test', '123456');
  });

  it('stores only a digest of the cookie handle', async () => {
    const s = setup();
    const handle = await signIn(s);
    expect([...s.sessions.keys()]).toEqual([handleDigest(handle)]);
    expect([...s.sessions.keys()][0]).not.toContain(handle);
  });

  it('refuses a wrong code without a cookie', async () => {
    const s = setup();
    const response = await s.verify(post('verify', { email: 'a@b.test', code: '000000' }));
    expect(response.status).toBe(401);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(s.sessions.size).toBe(0);
  });

  it('refuses a code that is not 6 to 10 digits before calling Supabase', async () => {
    const s = setup();
    for (const code of ['12345', 'abcdef', '1'.repeat(11), 123456]) {
      expect((await s.verify(post('verify', { email: 'a@b.test', code }))).status).toBe(400);
    }
    expect(s.supabase.verifyOtp).not.toHaveBeenCalled();
  });

  it('limits code guesses per email to five a minute', async () => {
    const s = setup();
    for (let i = 0; i < 5; i += 1) {
      expect((await s.verify(post('verify', { email: 'a@b.test', code: '000000' }))).status).toBe(
        401,
      );
    }
    expect((await s.verify(post('verify', { email: 'a@b.test', code: '123456' }))).status).toBe(
      429,
    );
  });

  it('gives a new handle on each sign-in and ends the session it replaces', async () => {
    const s = setup();
    const first = await signIn(s);
    const response = await s.verify(
      post(
        'verify',
        { email: 'a@b.test', code: '123456' },
        { Cookie: `${SESSION_COOKIE}=${first}` },
      ),
    );
    const second = handleFrom(response);
    expect(second).not.toBe(first);
    expect(s.sessions.has(handleDigest(first))).toBe(false);
    expect(s.sessions.has(handleDigest(second))).toBe(true);
  });
});

describe('GET /api/auth/session', () => {
  it('reports signed out with no cookie', async () => {
    const s = setup();
    const response = await s.session(get());
    expect(await response.json()).toEqual({ signedIn: false });
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('says "don\'t know" (null) for wider web search when that lookup fails', async () => {
    const s = setup();
    const handle = await signIn(s);
    const rpc = s.supabase.rpc.getMockImplementation();
    s.supabase.rpc.mockImplementation(async (fn, a) => {
      if (fn === 'can_search_wider_web') throw new SupabaseError('unavailable', 0);
      return rpc?.(fn, a);
    });
    expect(await (await s.session(get(handle))).json()).toMatchObject({
      signedIn: true,
      widerWeb: null,
    });
  });

  it('reports the signed-in email and balance, never tokens', async () => {
    const s = setup();
    const response = await s.session(get(await signIn(s)));
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      signedIn: true,
      email: 'reader@example.test',
      quota: { available: 7, reserved: 1 },
      widerWeb: true,
    });
    expect(text).not.toMatch(/access-|refresh-/);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(s.supabase.rpc).toHaveBeenCalledWith('quota_of', { p_user: USER });
  });

  it('clears a cookie whose session is gone', async () => {
    const s = setup();
    const response = await s.session(get('a'.repeat(43)));
    expect(await response.json()).toEqual({ signedIn: false });
    expect(response.headers.get('Set-Cookie')).toMatch(/pcd_session=;.*Max-Age=0/);
  });

  it('ignores a cookie that is not a handle we issue', async () => {
    const s = setup();
    await s.session(get('../../etc'));
    expect(s.supabase.rpc).not.toHaveBeenCalled();
  });

  it('refuses a stored session whose tokens belong to someone else', async () => {
    const s = setup();
    const handle = await signIn(s);
    const row = s.sessions.get(handleDigest(handle));
    if (!row) throw new Error('no session');
    row.tokens = JSON.stringify(tokens(1, 3600, '22222222-2222-4222-8222-222222222222'));
    expect(await (await s.session(get(handle))).json()).toEqual({ signedIn: false });
    expect(s.sessions.size).toBe(0);
  });
});

describe('token refresh', () => {
  it('refreshes an expiring token once and stores the new one', async () => {
    const s = setup();
    const handle = await signIn(s);
    expire(s, handle);
    expect((await (await s.session(get(handle))).json()).signedIn).toBe(true);
    expect(s.supabase.refresh).toHaveBeenCalledWith('refresh-1');
    const row = s.sessions.get(handleDigest(handle));
    expect(row?.version).toBe(2);
    expect(row?.leaseOwner).toBeNull();
    expect(JSON.parse(row?.tokens ?? '{}').refresh_token).toBe('refresh-2');
  });

  it('two requests at once spend the refresh token only once', async () => {
    const s = setup({ wait: (ms) => new Promise((done) => setTimeout(done, ms / 50)) });
    const handle = await signIn(s);
    expire(s, handle);
    s.supabase.refresh.mockImplementationOnce(async () => {
      await new Promise((done) => setTimeout(done, 10));
      return tokens(2);
    });
    const [a, b] = await Promise.all([s.session(get(handle)), s.session(get(handle))]);
    expect([(await a.json()).signedIn, (await b.json()).signedIn]).toEqual([true, true]);
    expect(s.supabase.refresh).toHaveBeenCalledTimes(1);
  });

  it('signs out when Supabase refuses the refresh token', async () => {
    const s = setup();
    const handle = await signIn(s);
    expire(s, handle);
    s.supabase.refresh.mockRejectedValueOnce(new SupabaseError('invalid', 400));
    const response = await s.session(get(handle));
    expect(await response.json()).toEqual({ signedIn: false });
    expect(s.sessions.size).toBe(0);
  });

  it('keeps the session and says unavailable when the refresh gets no clear answer', async () => {
    const s = setup();
    const handle = await signIn(s);
    expire(s, handle);
    s.supabase.refresh.mockRejectedValueOnce(new SupabaseError('unavailable', 0));
    expect((await s.session(get(handle))).status).toBe(503);
    const row = s.sessions.get(handleDigest(handle));
    expect(row?.leaseOwner).toBeNull();
    expect(row?.version).toBe(1);
  });

  it('keeps the session when Supabase rejects our API key (401), so one bad key signs nobody out', async () => {
    const s = setup();
    const handle = await signIn(s);
    expire(s, handle);
    s.supabase.refresh.mockRejectedValueOnce(new SupabaseError('unavailable', 401));
    expect((await s.session(get(handle))).status).toBe(503);
    expect(s.sessions.size).toBe(1);
  });

  it('saves refreshed tokens even if its lease ran out meanwhile, unless newer ones were saved', async () => {
    const s = setup();
    const handle = await signIn(s);
    expire(s, handle);
    s.supabase.refresh.mockImplementationOnce(async () => {
      const row = s.sessions.get(handleDigest(handle));
      if (row) row.leaseOwner = 'took-over-after-expiry';
      return tokens(2);
    });
    expect((await (await s.session(get(handle))).json()).signedIn).toBe(true);
    const row = s.sessions.get(handleDigest(handle));
    expect(JSON.parse(row?.tokens ?? '{}').refresh_token).toBe('refresh-2');
    expect(row?.leaseOwner).toBe('took-over-after-expiry');
  });

  it("gives up waiting on someone else's refresh rather than refreshing with an old token", async () => {
    const s = setup();
    const handle = await signIn(s);
    expire(s, handle);
    const row = s.sessions.get(handleDigest(handle));
    if (!row) throw new Error('no session');
    row.leaseOwner = 'someone-else';
    expect((await s.session(get(handle))).status).toBe(503);
    expect(s.supabase.refresh).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/password', () => {
  const GOOD = 'correct horse battery';

  it('signs in with the right password, with the same cookie and no tokens', async () => {
    const s = setup();
    const response = await s.password(
      post('password', { email: 'Reader@Example.test', password: GOOD }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toMatch(
      /pcd_session=.+HttpOnly.*Secure.*SameSite=Strict/,
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const text = await response.text();
    expect(text).not.toMatch(/access-|refresh-|correct horse/);
    expect(s.supabase.signInWithPassword).toHaveBeenCalledWith('reader@example.test', GOOD);
  });

  it('gives one answer for a wrong password and an unknown account', async () => {
    const s = setup();
    const wrong = await s.password(
      post('password', { email: 'reader@example.test', password: 'nope' }),
    );
    const unknown = await s.password(
      post('password', { email: 'nobody@example.test', password: 'nope' }),
    );
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(wrong.headers.get('Set-Cookie')).toBeNull();
  });

  it('shares the guess limit with codes, so switching method gives no extra tries', async () => {
    const s = setup();
    for (let i = 0; i < 3; i += 1) {
      await s.password(post('password', { email: 'a@b.test', password: 'nope' }));
    }
    for (let i = 0; i < 2; i += 1) {
      await s.verify(post('verify', { email: 'a@b.test', code: '000000' }));
    }
    expect((await s.password(post('password', { email: 'a@b.test', password: GOOD }))).status).toBe(
      429,
    );
  });

  it('refuses an empty or over-long password before calling Supabase', async () => {
    const s = setup();
    for (const password of ['', 'é'.repeat(37), 42]) {
      expect((await s.password(post('password', { email: 'a@b.test', password }))).status).toBe(
        400,
      );
    }
    expect(s.supabase.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/set-password', () => {
  const NEW = 'a brand new passphrase';

  it('needs a fresh emailed code: a wrong code changes nothing', async () => {
    const s = setup();
    const response = await s.setPassword(
      post('set-password', { email: 'a@b.test', code: '000000', password: NEW }),
    );
    expect(response.status).toBe(401);
    expect(s.supabase.updatePassword).not.toHaveBeenCalled();
  });

  it('refuses a password under 10 characters before checking the code', async () => {
    const s = setup();
    const response = await s.setPassword(
      post('set-password', { email: 'a@b.test', code: '123456', password: 'short' }),
    );
    expect(await response.json()).toEqual({ error: 'weak_password' });
    expect(s.supabase.verifyOtp).not.toHaveBeenCalled();
  });

  it('sets the password, signs out every other session and signs this browser in', async () => {
    const s = setup();
    const elsewhere = await signIn(s);
    const response = await s.setPassword(
      post('set-password', { email: 'reader@example.test', code: '123456', password: NEW }),
    );
    expect(response.status).toBe(200);
    expect(s.supabase.updatePassword).toHaveBeenCalledWith('access-1', NEW);
    expect(s.sessions.has(handleDigest(elsewhere))).toBe(false);
    expect(s.sessions.has(handleDigest(handleFrom(response)))).toBe(true);
    expect(await response.text()).not.toContain(NEW);
  });

  it("when Supabase refuses the new password, signs nobody in and closes the code's session", async () => {
    const s = setup();
    s.supabase.updatePassword.mockRejectedValueOnce(
      new SupabaseError('invalid', 422, 'weak_password'),
    );
    const response = await s.setPassword(
      post('set-password', { email: 'reader@example.test', code: '123456', password: NEW }),
    );
    expect(await response.json()).toEqual({ error: 'weak_password' });
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(s.sessions.size).toBe(0);
    expect(s.supabase.logout).toHaveBeenCalledWith('access-1');
  });
});

describe('set-password failures', () => {
  const NEW = 'a brand new passphrase';
  const ask = (s: ReturnType<typeof setup>) =>
    s.setPassword(
      post('set-password', { email: 'reader@example.test', code: '123456', password: NEW }),
    );

  it('changes nothing when other sessions could not be signed out', async () => {
    const s = setup();
    const rpc = s.supabase.rpc.getMockImplementation();
    s.supabase.rpc.mockImplementation(async (fn, a) => {
      if (fn === 'end_user_sessions') throw new SupabaseError('unavailable', 0);
      return rpc?.(fn, a);
    });
    const response = await ask(s);
    expect(response.status).toBe(503);
    expect(s.supabase.updatePassword).not.toHaveBeenCalled();
    expect(s.supabase.logout).toHaveBeenCalledWith('access-1');
  });

  it('says when the new password is the same as the old one', async () => {
    const s = setup();
    s.supabase.updatePassword.mockRejectedValueOnce(
      new SupabaseError('invalid', 422, 'same_password'),
    );
    expect(await (await ask(s)).json()).toEqual({ error: 'same_password' });
  });

  it('treats any other refusal as "try again", not as a weak password', async () => {
    const s = setup();
    s.supabase.updatePassword.mockRejectedValueOnce(
      new SupabaseError('invalid', 403, 'reauthentication_needed'),
    );
    expect((await ask(s)).status).toBe(503);
  });
});

describe('/api/auth/<action> routes', () => {
  it('share one guess limit across code, password and set-password', async () => {
    const fake = fakeSupabase();
    const routes = createAuthRoutes({ config: CONFIG, supabase: fake.supabase, now: () => NOW });
    const email = 'a@b.test';
    await routes.POST(post('verify', { email, code: '000000' }));
    await routes.POST(post('verify', { email, code: '000000' }));
    await routes.POST(post('password', { email, password: 'nope' }));
    await routes.POST(post('password', { email, password: 'nope' }));
    await routes.POST(
      post('set-password', { email, code: '000000', password: 'a brand new passphrase' }),
    );
    const sixth = await routes.POST(post('password', { email, password: 'correct horse battery' }));
    expect(sixth.status).toBe(429);
  });

  it('answers 404 for unknown actions and for GET on a POST action', async () => {
    const fake = fakeSupabase();
    const routes = createAuthRoutes({ config: CONFIG, supabase: fake.supabase, now: () => NOW });
    expect((await routes.POST(post('toString', {}))).status).toBe(404);
    expect((await routes.GET(new Request(`${ORIGIN}/api/auth/logout`))).status).toBe(404);
    expect((await routes.GET(new Request(`${ORIGIN}/api/auth/session`))).status).toBe(200);
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session here and at Supabase and clears the cookie', async () => {
    const s = setup();
    const handle = await signIn(s);
    const response = await s.logout(post('logout', {}, { Cookie: `${SESSION_COOKIE}=${handle}` }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toMatch(/pcd_session=;.*Max-Age=0/);
    expect(s.sessions.size).toBe(0);
    expect(s.supabase.logout).toHaveBeenCalledWith('access-1');
  });

  it('still signs this browser out when Supabase logout fails', async () => {
    const s = setup();
    const handle = await signIn(s);
    s.supabase.logout.mockRejectedValueOnce(new SupabaseError('unavailable', 0));
    const response = await s.logout(post('logout', {}, { Cookie: `${SESSION_COOKIE}=${handle}` }));
    expect(response.status).toBe(200);
    expect(s.sessions.size).toBe(0);
  });

  it('clears the cookie even with no session', async () => {
    const s = setup();
    const response = await s.logout(post('logout', {}));
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toMatch(/Max-Age=0/);
  });
});
