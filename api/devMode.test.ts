// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearedSessionCookie, sessionCookie } from './_lib/session';
import { devFlag } from './_lib/devFlags';
import { createHandler } from './web-search';

const QUERY = 'why are ferrari fans depressed';

function request(): Request {
  return new Request('https://localhost:3000/api/web-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: QUERY }),
  });
}

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'development');
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('PARALLEL_API_KEY', '');
  vi.stubEnv('WEB_SEARCH_FAKE', '');
  vi.stubEnv('ACCESS_COOKIE_INSECURE_DEV', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('dev flags', () => {
  it('are off unless set to "1"', () => {
    expect(devFlag('WEB_SEARCH_FAKE')).toBe(false);
    vi.stubEnv('WEB_SEARCH_FAKE', 'true');
    expect(devFlag('WEB_SEARCH_FAKE')).toBe(false);
    vi.stubEnv('WEB_SEARCH_FAKE', '1');
    expect(devFlag('WEB_SEARCH_FAKE')).toBe(true);
  });

  it('fail closed when no environment says local development', () => {
    vi.stubEnv('WEB_SEARCH_FAKE', '1');
    vi.stubEnv('VERCEL_ENV', '');
    expect(devFlag('WEB_SEARCH_FAKE')).toBe(false);
    vi.stubEnv('NODE_ENV', 'production');
    expect(devFlag('WEB_SEARCH_FAKE')).toBe(false);
    vi.stubEnv('NODE_ENV', 'development');
    expect(devFlag('WEB_SEARCH_FAKE')).toBe(true);
  });

  it('ignore NODE_ENV=development on a Vercel deployment', () => {
    vi.stubEnv('WEB_SEARCH_FAKE', '1');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(devFlag('WEB_SEARCH_FAKE')).toBe(false);
  });

  it.each(['production', 'preview'])('are always off on a %s deployment', (deployment) => {
    vi.stubEnv('VERCEL_ENV', deployment);
    vi.stubEnv('WEB_SEARCH_FAKE', '1');
    vi.stubEnv('ACCESS_COOKIE_INSECURE_DEV', '1');
    expect(devFlag('WEB_SEARCH_FAKE')).toBe(false);
    expect(devFlag('ACCESS_COOKIE_INSECURE_DEV')).toBe(false);
  });
});

describe('fake provider (WEB_SEARCH_FAKE=1)', () => {
  it('answers with canned, fully cleaned results without a key or calling Parallel', async () => {
    vi.stubEnv('WEB_SEARCH_FAKE', '1');
    const fetchMock = vi.fn<typeof fetch>();
    const handle = createHandler({ fetch: fetchMock, checkAccess: () => 'ok' });
    const response = await handle(request());
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      storage: string;
      results: Record<string, unknown>[];
    };
    expect(fetchMock).not.toHaveBeenCalled();
    expect(body.storage).toBe('device');
    expect(body.results).toHaveLength(3);
    for (const result of body.results) {
      expect(Object.keys(result).sort()).toEqual(['snippet', 'storage', 'title', 'url']);
      expect(result.storage).toBe('device');
      expect(String(result.url)).toMatch(/^https:\/\/example\.com\/local-test\/\d$/);
    }
    expect(body.results[0]?.snippet).toMatch(new RegExp(`^Fake answer 1 for ${QUERY}\\b`));
    expect(body.results[0]?.snippet).toContain('No real search was made, so nothing was spent.');
    expect(JSON.stringify(body)).not.toMatch(/\.png|<i>|\*\*/);
  });

  it('still needs a signed-in person with the wider web turned on', async () => {
    vi.stubEnv('WEB_SEARCH_FAKE', '1');
    const handle = createHandler({ fetch: vi.fn<typeof fetch>(), checkAccess: () => 'signed_out' });
    expect((await handle(request())).status).toBe(401);
  });

  it('is refused in production: the real path runs (and needs the key)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('WEB_SEARCH_FAKE', '1');
    const fetchMock = vi.fn<typeof fetch>();
    const handle = createHandler({ fetch: fetchMock, checkAccess: () => 'ok' });
    expect(await (await handle(request())).json()).toEqual({ error: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv('PARALLEL_API_KEY', 'test-only-not-a-real-key');
    const real = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    await createHandler({ fetch: real, checkAccess: () => 'ok' })(request());
    expect(real).toHaveBeenCalledTimes(1);
  });
});

describe('insecure dev session cookie (ACCESS_COOKIE_INSECURE_DEV=1)', () => {
  it('drops Secure only on a local machine', () => {
    expect(sessionCookie('t')).toContain('Secure');
    vi.stubEnv('ACCESS_COOKIE_INSECURE_DEV', '1');
    expect(sessionCookie('t')).not.toContain('Secure');
    expect(clearedSessionCookie()).not.toContain('Secure');
    expect(sessionCookie('t')).toContain('HttpOnly');
    expect(sessionCookie('t')).toContain('SameSite=Strict');
  });

  it.each(['production', 'preview'])('keeps Secure on a %s deployment', (deployment) => {
    vi.stubEnv('VERCEL_ENV', deployment);
    vi.stubEnv('ACCESS_COOKIE_INSECURE_DEV', '1');
    expect(sessionCookie('t')).toContain('Secure');
    expect(clearedSessionCookie()).toContain('Secure');
  });
});
