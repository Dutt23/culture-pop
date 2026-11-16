import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectSrc } from './hosts';
import {
  createWebSearch,
  LOCK_PATH,
  parseWebResults,
  UNLOCK_PATH,
  WEB_SEARCH_PATH,
  WebSearchError,
} from './webSearch';

const BARE = {
  title: 'Why are Ferrari fans always sad?',
  url: 'https://www.reddit.com/r/formula1/comments/abc/',
  snippet: 'Because the team keeps throwing away wins.',
};
const RESULT = { ...BARE, storage: 'device' };

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function setup(response: Response | Error, online = true) {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const client = createWebSearch({ fetch: fetchMock, isOnline: () => online });
  return { fetchMock, client };
}

async function failureOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof WebSearchError ? error.failure : 'not a WebSearchError';
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('search', () => {
  it('posts the query in the body to our own function, never in the URL', async () => {
    const { fetchMock, client } = setup(answer({ storage: 'device', results: [RESULT] }));
    expect(await client.search('  why are ferrari fans depressed ')).toEqual([RESULT]);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(WEB_SEARCH_PATH);
    expect(String(url)).not.toContain('ferrari');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ q: 'why are ferrari fans depressed' });
    expect(init).toMatchObject({
      credentials: 'same-origin',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      redirect: 'error',
    });
  });

  it('is covered by the CSP without adding a host', () => {
    for (const path of [WEB_SEARCH_PATH, UNLOCK_PATH, LOCK_PATH]) {
      expect(path.startsWith('/api/')).toBe(true);
    }
    expect(connectSrc()).toMatch(/^connect-src 'self'/);
  });

  it('never calls the network when offline', async () => {
    const { fetchMock, client } = setup(answer({ results: [] }), false);
    expect(await failureOf(client.search('ferrari fans'))).toBe('offline');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, { error: 'locked' }, 'locked'],
    [400, { error: 'bad_query' }, 'bad_query'],
    [429, { error: 'daily_cap' }, 'daily_cap'],
    [429, { error: 'rate_limited' }, 'rate_limited'],
    [503, { error: 'not_configured' }, 'not_configured'],
    [403, { error: 'cross_site' }, 'blocked'],
    [502, { error: 'provider_failed' }, 'failed'],
    [500, 'not json', 'failed'],
  ])('maps HTTP %i %j to %s', async (status, body, failure) => {
    const { client } = setup(answer(body, status));
    expect(await failureOf(client.search('ferrari fans'))).toBe(failure);
  });

  it('reports a network failure as failed', async () => {
    const { client } = setup(new TypeError('Failed to fetch'));
    expect(await failureOf(client.search('ferrari fans'))).toBe('failed');
  });

  it('times out instead of waiting for ever', async () => {
    vi.useFakeTimers();
    const hanging = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new TypeError('aborted')));
        }),
    );
    const client = createWebSearch({ fetch: hanging, isOnline: () => true, timeoutMs: 1000 });
    const pending = failureOf(client.search('ferrari fans'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toBe('failed');
  });

  it('reports a cancelled search as aborted', async () => {
    const controller = new AbortController();
    const hanging = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new TypeError('aborted')));
        }),
    );
    const client = createWebSearch({ fetch: hanging, isOnline: () => true });
    const pending = failureOf(client.search('ferrari fans', controller.signal));
    controller.abort();
    expect(await pending).toBe('aborted');
  });
});

describe('unlock and lock', () => {
  it('posts the code once as JSON to our own unlock function', async () => {
    const { fetchMock, client } = setup(answer({ ok: true }));
    await client.unlock('open-sesame-42');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(UNLOCK_PATH);
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(init?.body))).toEqual({ code: 'open-sesame-42' });
  });

  it('reports a wrong code', async () => {
    const { client } = setup(answer({ error: 'wrong_code' }, 401));
    expect(await failureOf(client.unlock('nope'))).toBe('wrong_code');
  });

  it('asks the server to forget the code', async () => {
    const { fetchMock, client } = setup(answer({ ok: true }));
    await client.lock();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(LOCK_PATH);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
  });
});

describe('parseWebResults', () => {
  it('drops unsafe links and malformed items, and caps lengths and count', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...RESULT,
      url: `https://example.test/${i}`,
      title: 'T'.repeat(500),
      snippet: 's'.repeat(900),
    }));
    const parsed = parseWebResults({
      results: [
        { ...RESULT, url: 'javascript:alert(1)' },
        { ...RESULT, url: 'http://example.test/' },
        { ...RESULT, title: 7 },
        'nonsense',
        ...many,
      ],
    });
    expect(parsed).toHaveLength(10);
    for (const result of parsed) {
      expect(result.url.startsWith('https://example.test/')).toBe(true);
      expect(result.title.length).toBeLessThanOrEqual(120);
      expect(result.snippet.length).toBeLessThanOrEqual(300);
    }
  });

  it.each([
    ['missing', {}, {}],
    ['malformed', { storage: 42 }, { storage: 42 }],
    ['unknown', { storage: 'everywhere' }, { storage: 'everywhere' }],
    ['device on the answer only', { storage: 'device' }, {}],
    ['device on the result only', {}, { storage: 'device' }],
  ])('treats a storage level that is %s as none', (_label, batch, item) => {
    const parsed = parseWebResults({ ...batch, results: [{ ...BARE, ...item }] });
    expect(parsed).toEqual([{ ...BARE, storage: 'none' }]);
  });

  it('keeps device on both as device, and reads shared as device on this side', () => {
    const device = { storage: 'device' };
    const shared = { storage: 'shared' };
    expect(parseWebResults({ ...device, results: [{ ...BARE, ...device }] })).toEqual([RESULT]);
    expect(parseWebResults({ ...shared, results: [{ ...BARE, ...shared }] })).toEqual([RESULT]);
  });

  it('keeps only title, url, snippet and the storage level', () => {
    const [parsed] = parseWebResults({
      results: [{ ...RESULT, image: 'https://cdn.test/a.png', html: '<img src=x>' }],
    });
    expect(Object.keys(parsed ?? {}).sort()).toEqual(['snippet', 'storage', 'title', 'url']);
  });

  it('rejects a body without a results list', () => {
    expect(() => parseWebResults({ nope: 1 })).toThrow(WebSearchError);
  });
});
