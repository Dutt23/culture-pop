// @vitest-environment node
import * as crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAccess, COOKIE_NAME, issueToken, verifyToken } from './_lib/access';
import { POST as lock } from './lock';
import { createUnlockHandler } from './unlock';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

const CODE = 'test-code-1234';
const SECRET = 'test-secret-'.padEnd(40, 'x');
const CONFIG = { code: CODE, secret: SECRET };
const NOW = Date.parse('2026-11-16T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function unlockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://app.example.test/api/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function withCookie(token: string): Request {
  return new Request('https://app.example.test/api/web-search?q=x', {
    headers: { Cookie: `other=1; ${COOKIE_NAME}=${token}` },
  });
}

function setup() {
  const sleep = vi.fn(async () => {});
  const unlock = createUnlockHandler({ now: () => NOW, sleep });
  return { sleep, unlock };
}

beforeEach(() => {
  vi.stubEnv('ACCESS_CODE', CODE);
  vi.stubEnv('ACCESS_COOKIE_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.mocked(crypto.timingSafeEqual).mockClear();
});

describe('unlock', () => {
  it('sets a signed HttpOnly cookie for the right code', async () => {
    const { unlock, sleep } = setup();
    const response = await unlock(unlockRequest({ code: CODE }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const cookie = response.headers.get('Set-Cookie') ?? '';
    expect(cookie).toMatch(new RegExp(`^${COOKIE_NAME}=[^;]+;`));
    const flags = ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api', 'Max-Age=2592000'];
    for (const flag of flags) expect(cookie).toContain(flag);
    expect(cookie).not.toContain(CODE);
    const token = cookie.split(';')[0]?.split('=').slice(1).join('=') ?? '';
    expect(verifyToken(token, CONFIG, NOW)).toBe(true);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('refuses a wrong code after a fixed delay, without a cookie', async () => {
    const { unlock, sleep } = setup();
    const response = await unlock(unlockRequest({ code: 'not-the-code' }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'wrong_code' });
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('answers 429 after 10 wrong codes in a minute, then lets the right one in', async () => {
    let now = NOW;
    const unlock = createUnlockHandler({ now: () => now, sleep: async () => {} });
    for (let i = 0; i < 10; i++) {
      expect((await unlock(unlockRequest({ code: `guess-${i}` }))).status).toBe(401);
    }
    expect(await (await unlock(unlockRequest({ code: CODE }))).json()).toEqual({
      error: 'too_many_attempts',
    });
    now += 60_000;
    expect((await unlock(unlockRequest({ code: CODE }))).status).toBe(200);
  });

  it('compares the code in constant time', async () => {
    const { unlock } = setup();
    await unlock(unlockRequest({ code: 'not-the-code' }));
    expect(crypto.timingSafeEqual).toHaveBeenCalled();
  });

  it.each([
    ['no body', ''],
    ['not JSON', 'code=1234'],
    ['no code', { nope: 1 }],
    ['an empty code', { code: '' }],
    ['a number', { code: 1234 }],
    ['a huge body', { code: 'x'.repeat(5000) }],
  ])('answers 400 for %s', async (_label, body) => {
    const { unlock } = setup();
    expect((await unlock(unlockRequest(body))).status).toBe(400);
  });

  it('answers 503 when either setting is missing or too weak', async () => {
    const { unlock } = setup();
    vi.stubEnv('ACCESS_COOKIE_SECRET', '');
    expect((await unlock(unlockRequest({ code: CODE }))).status).toBe(503);
    vi.stubEnv('ACCESS_COOKIE_SECRET', 'short');
    expect((await unlock(unlockRequest({ code: CODE }))).status).toBe(503);
    vi.stubEnv('ACCESS_COOKIE_SECRET', SECRET);
    vi.stubEnv('ACCESS_CODE', '');
    expect((await unlock(unlockRequest({ code: '' }))).status).toBe(503);
  });

  it('refuses cross-site requests', async () => {
    const { unlock } = setup();
    const crossSite = unlockRequest({ code: CODE }, { 'Sec-Fetch-Site': 'cross-site' });
    expect((await unlock(crossSite)).status).toBe(403);
  });

  it('never logs the code or the cookie', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const { unlock } = setup();
    const ok = await unlock(unlockRequest({ code: CODE }));
    await unlock(unlockRequest({ code: 'not-the-code' }));
    await unlock(unlockRequest('garbage'));
    const token = ok.headers.get('Set-Cookie')?.split(';')[0] ?? 'missing';
    const logged = spies.flatMap((spy) => spy.mock.calls.flat().map(String)).join('\n');
    expect(logged).not.toContain(CODE);
    expect(logged).not.toContain('not-the-code');
    expect(logged).not.toContain(token);
  });
});

describe('cookie check', () => {
  it('accepts a fresh token', () => {
    expect(checkAccess(withCookie(issueToken(CONFIG, NOW)), NOW)).toBe('ok');
  });

  it('is locked without a cookie', () => {
    expect(checkAccess(new Request('https://app.example.test/api/web-search'), NOW)).toBe('locked');
  });

  it('rejects an expired token', () => {
    const token = issueToken(CONFIG, NOW - 31 * DAY_MS);
    expect(checkAccess(withCookie(token), NOW)).toBe('locked');
  });

  it('rejects a tampered expiry or signature', () => {
    const [expires, version, signature] = issueToken(CONFIG, NOW).split('.');
    const later = `${Number(expires) + 365 * 24 * 3600}.${version}.${signature}`;
    const first = signature?.startsWith('A') ? 'B' : 'A';
    const forged = `${expires}.${version}.${first}${signature?.slice(1)}`;
    expect(checkAccess(withCookie(later), NOW)).toBe('locked');
    expect(checkAccess(withCookie(forged), NOW)).toBe('locked');
    expect(checkAccess(withCookie('nonsense'), NOW)).toBe('locked');
    expect(checkAccess(withCookie('1.2.3.4'), NOW)).toBe('locked');
  });

  it('rejects a token signed with another secret', () => {
    const token = issueToken({ code: CODE, secret: 'another-secret-'.padEnd(40, 'y') }, NOW);
    expect(checkAccess(withCookie(token), NOW)).toBe('locked');
  });

  it('rejects every old token once the code changes', () => {
    const token = issueToken(CONFIG, NOW);
    vi.stubEnv('ACCESS_CODE', 'a-brand-new-code');
    expect(checkAccess(withCookie(token), NOW)).toBe('locked');
  });

  it('reports missing settings instead of letting anyone in', () => {
    vi.stubEnv('ACCESS_CODE', '');
    expect(checkAccess(withCookie(issueToken(CONFIG, NOW)), NOW)).toBe('not_configured');
  });

  it('compares signatures in constant time', () => {
    checkAccess(withCookie(issueToken(CONFIG, NOW)), NOW);
    expect(crypto.timingSafeEqual).toHaveBeenCalled();
  });
});

describe('lock', () => {
  it('clears the cookie with the same flags', async () => {
    const response = lock(new Request('https://app.example.test/api/lock', { method: 'POST' }));
    expect(response.status).toBe(200);
    const cookie = response.headers.get('Set-Cookie') ?? '';
    expect(cookie).toMatch(new RegExp(`^${COOKIE_NAME}=;`));
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Path=/api');
    expect(cookie).toContain('HttpOnly');
  });
});
