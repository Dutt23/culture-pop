// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COOKIE_NAME, issueToken } from './_lib/access';
import { createHandler, type HandlerOptions } from './web-search';

const QUERY = 'why are ferrari fans depressed';
const DUMMY_KEY = 'test-only-not-a-real-key';
const ACCESS = { code: 'test-code-1234', secret: 'test-secret-'.padEnd(40, 'x') };

const URL_PATH = 'https://app.example.test/api/web-search';

/** The query goes in a POST body, never the URL. `null` sends a body without `q`. */
function request(q: string | null, headers: Record<string, string> = {}): Request {
  return rawRequest(JSON.stringify(q === null ? {} : { q }), headers);
}

/** A search the app says is a question; any `question` value can be sent to test validation. */
function questionRequest(q: string, question: unknown = true): Request {
  return rawRequest(JSON.stringify({ q, question }));
}

/** What the handler sent to Parallel on its first call. */
function sentOf(fetchMock: { mock: { calls: Parameters<typeof fetch>[] } }) {
  return JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
    objective: string;
    search_queries: string[];
  };
}

function rawRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request(URL_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
}

function upstream(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function hit(overrides: Record<string, unknown> = {}) {
  return {
    url: 'https://www.reddit.com/r/formula1/comments/abc/why_so_sad/',
    title: 'Why are Ferrari fans always sad?',
    publish_date: null,
    excerpts: ['Because the team keeps **throwing** away wins. See [this thread](https://x.test).'],
    ...overrides,
  };
}

/** Access is tested on its own below; these tests start already unlocked. */
function setup(body: unknown = { results: [hit()] }, options: HandlerOptions = {}) {
  const fetchMock = vi.fn<typeof fetch>(async () => upstream(body));
  const handle = createHandler({ fetch: fetchMock, checkAccess: () => 'ok', ...options });
  return { fetchMock, handle };
}

function unlocked(fetchImpl: typeof fetch) {
  return createHandler({ fetch: fetchImpl, checkAccess: () => 'ok' });
}

interface Read {
  status: number;
  body: Record<string, unknown>;
}

async function read(response: Response): Promise<Read> {
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.stubEnv('PARALLEL_API_KEY', DUMMY_KEY);
  vi.stubEnv('ACCESS_CODE', ACCESS.code);
  vi.stubEnv('ACCESS_COOKIE_SECRET', ACCESS.secret);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('access code', () => {
  it('answers 401 without a cookie and never calls Parallel', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const handle = createHandler({ fetch: fetchMock });
    expect(await read(await handle(request(QUERY)))).toEqual({
      status: 401,
      body: { error: 'locked' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searches with a valid cookie', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => upstream({ results: [hit()] }));
    const handle = createHandler({ fetch: fetchMock });
    const cookie = `${COOKIE_NAME}=${issueToken(ACCESS, Date.now())}`;
    expect((await handle(request(QUERY, { Cookie: cookie }))).status).toBe(200);
  });

  it('answers 503 when the access settings are missing, never open by default', async () => {
    vi.stubEnv('ACCESS_CODE', '');
    const fetchMock = vi.fn<typeof fetch>();
    const handle = createHandler({ fetch: fetchMock });
    const cookie = `${COOKIE_NAME}=${issueToken(ACCESS, Date.now())}`;
    expect(await read(await handle(request(QUERY, { Cookie: cookie })))).toEqual({
      status: 503,
      body: { error: 'not_configured' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks access before reading the query', async () => {
    const handle = createHandler({ fetch: vi.fn<typeof fetch>() });
    expect((await handle(request('a'))).status).toBe(401);
  });
});

describe('query validation', () => {
  it.each([
    ['missing', null],
    ['one character', 'a'],
    ['only spaces', '    '],
    ['201 characters', 'x'.repeat(201)],
    ['a control character', 'why\u0000 ferrari'],
    ['a newline', 'why\nferrari'],
    ['a C1 control character', 'why\u0085ferrari'],
  ])('rejects %s with 400 and never calls Parallel', async (_label, q) => {
    const { fetchMock, handle } = setup();
    const { status, body } = await read(await handle(request(q)));
    expect(status).toBe(400);
    expect(body).toEqual({ error: 'bad_query' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['not JSON', 'q=why are ferrari fans depressed'],
    ['an empty body', ''],
    ['a number for q', JSON.stringify({ q: 42 })],
    ['a body over 2 KB', JSON.stringify({ q: QUERY, padding: 'x'.repeat(3000) })],
  ])('rejects %s with 400', async (_label, body) => {
    const { fetchMock, handle } = setup();
    expect(await read(await handle(rawRequest(body)))).toEqual({
      status: 400,
      body: { error: 'bad_query' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores a query in the URL: only the body counts', async () => {
    const { fetchMock, handle } = setup();
    const inUrl = new Request(`${URL_PATH}?q=${encodeURIComponent(QUERY)}`, { method: 'POST' });
    expect((await handle(inUrl)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts 2 and 200 characters', async () => {
    const { handle } = setup();
    expect((await handle(request('ab'))).status).toBe(200);
    expect((await handle(request('y'.repeat(200)))).status).toBe(200);
  });

  it('trims and collapses whitespace before sending', async () => {
    const { fetchMock, handle } = setup();
    await handle(request('   why  are   ferrari fans depressed  '));
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      search_queries: string[];
    };
    expect(sent.search_queries).toEqual([QUERY]);
  });
});

describe('upstream request', () => {
  it('posts the query to Parallel in fast mode with the key header and no session id', async () => {
    const { fetchMock, handle } = setup();
    await handle(request(QUERY));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.parallel.ai/v1/search');
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('error');
    expect((init?.headers as Record<string, string>)['x-api-key']).toBe(DUMMY_KEY);
    const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(sent).toMatchObject({
      search_queries: [QUERY],
      mode: 'fast',
      advanced_settings: { max_results: 10 },
    });
    expect(sent).not.toHaveProperty('session_id');
  });

  it('asks Parallel for the meaning and origin of the query, not just the bare words', async () => {
    const { fetchMock, handle } = setup();
    await handle(request(QUERY));
    const { objective } = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      objective: string;
    };
    expect(objective).toContain(`"${QUERY}"`);
    expect(objective).toMatch(/means/);
    expect(objective).toMatch(/comes from/);
  });
});

describe('question searches', () => {
  const SUFFIX = ' in fiction myths anime films TV books games';

  it('asks for fiction and pop culture, and widens the search query to match', async () => {
    const { fetchMock, handle } = setup();
    await handle(questionRequest('who committed the worst genocides'));
    const { objective, search_queries } = sentOf(fetchMock);
    expect(objective).toContain('"who committed the worst genocides"');
    expect(objective).toMatch(/fiction, myths and pop culture/);
    expect(objective).toMatch(/legends and folklore/);
    expect(objective).toMatch(/not real-world history or news/);
    expect(search_queries).toEqual([`who committed the worst genocides${SUFFIX}`]);
  });

  it('cuts a long question so the search query stays within 200 characters', async () => {
    const { fetchMock, handle } = setup();
    expect((await handle(questionRequest('why '.repeat(50).trim()))).status).toBe(200);
    const [query] = sentOf(fetchMock).search_queries;
    expect(query).toHaveLength(200);
    expect(query?.endsWith(`…${SUFFIX}`)).toBe(true);
  });

  it('leaves a search that is not a question exactly as it was', async () => {
    const { fetchMock, handle } = setup();
    await handle(questionRequest('red pill', false));
    const { objective, search_queries } = sentOf(fetchMock);
    expect(search_queries).toEqual(['red pill']);
    expect(objective).toMatch(/comes from/);
    expect(objective).not.toMatch(/fiction, myths and pop culture/);
  });

  it.each([['true'], [1], ['yes'], [null], [{}]])(
    'treats a non-boolean flag (%j) as false, not as an error',
    async (flag) => {
      const { fetchMock, handle } = setup();
      expect((await handle(questionRequest(QUERY, flag))).status).toBe(200);
      expect(sentOf(fetchMock).search_queries).toEqual([QUERY]);
    },
  );
});

describe('search tags hint', () => {
  const withAbout = (about: unknown) => rawRequest(JSON.stringify({ q: 'red pill', about }));

  it('adds the tags to what it asks for, never to the search text', async () => {
    const { fetchMock, handle } = setup();
    expect((await handle(withAbout(['anime', 'Marvel']))).status).toBe(200);
    const { objective, search_queries } = sentOf(fetchMock);
    expect(objective).toMatch(/Prefer results about anime, Marvel\.$/);
    expect(search_queries).toEqual(['red pill']);
  });

  it('drops bad tags and keeps at most five, without failing the search', async () => {
    const { fetchMock, handle } = setup();
    const bad = ['x', 'a'.repeat(31), 'ok<script>', 42, 'a'];
    const good = ['  Bolly  wood ', 'b1', 'c2', 'd3', 'e4', 'f5'];
    expect((await handle(withAbout([...bad, ...good]))).status).toBe(200);
    expect(sentOf(fetchMock).objective).toMatch(
      /Prefer results about Bolly wood, b1, c2, d3, e4\.$/,
    );
  });

  it.each([['anime'], [null], [{ 0: 'anime' }], [[]]])(
    'ignores an about that is not a list of tags (%j)',
    async (about) => {
      const { fetchMock, handle } = setup();
      expect((await handle(withAbout(about))).status).toBe(200);
      expect(sentOf(fetchMock).objective).not.toMatch(/Prefer results/);
    },
  );

  it('accepts a full-length query with five full-length tags in four-byte letters', async () => {
    const { fetchMock, handle } = setup();
    // "𝒜" is a letter that takes two UTF-16 units and four UTF-8 bytes.
    const tag = '𝒜'.repeat(30);
    const body = JSON.stringify({ q: '𝒜'.repeat(100), question: true, about: Array(5).fill(tag) });
    expect((await handle(rawRequest(body))).status).toBe(200);
    expect(sentOf(fetchMock).objective).toContain(`about ${tag}, ${tag}`);
  });
});

describe('curation', () => {
  async function snippets(results: unknown[], q = QUERY): Promise<string[]> {
    const { handle } = setup({ results });
    const { body } = await read(await handle(request(q)));
    return (body.results as { snippet: string }[]).map((r) => r.snippet);
  }

  it('starts the snippet at the sentence that answers the search, from any excerpt', async () => {
    const [snippet] = await snippets([
      hit({
        excerpts: [
          'The company was founded in 1939 in Maranello. Its road cars are fast.',
          'Fans joke they are depressed because Ferrari keeps throwing away race wins. It is a meme.',
        ],
      }),
    ]);
    expect(snippet).toBe(
      'Fans joke they are depressed because Ferrari keeps throwing away race wins. It is a meme.',
    );
  });

  it('skips an earlier sentence in the same excerpt that does not answer it', async () => {
    const [snippet] = await snippets([
      hit({
        excerpts: [
          'Posted by u/someone 3 years ago. Ferrari fans are depressed because of bad strategy.',
        ],
      }),
    ]);
    expect(snippet).toBe('Ferrari fans are depressed because of bad strategy.');
  });

  it('prefers a sentence that explains (means, refers to, comes from) over a passing mention', async () => {
    const [snippet] = await snippets(
      [
        hit({
          excerpts: [
            'The red pill poster sold out in 1999.',
            'The red pill refers to waking up to an uncomfortable truth.',
          ],
        }),
      ],
      'red pill',
    );
    expect(snippet).toBe('The red pill refers to waking up to an uncomfortable truth.');
  });

  it('matches other forms of a word, like depressing for depressed', async () => {
    const [snippet] = await snippets([
      hit({ excerpts: ['Nothing to see here.', 'Being a Ferrari fan is depressing.'] }),
    ]);
    expect(snippet).toBe('Being a Ferrari fan is depressing.');
  });

  it('does not count a short word inside a longer one ("red" in "reddit")', async () => {
    const [snippet] = await snippets(
      [hit({ excerpts: ['Shared on reddit today.', 'Red pill is a Matrix reference.'] })],
      'red pill',
    );
    expect(snippet).toBe('Red pill is a Matrix reference.');
  });

  it('ignores accents, so pokemon finds Pokémon', async () => {
    const [snippet] = await snippets(
      [hit({ excerpts: ['Nothing here.', 'Pokémon means pocket monsters.'] })],
      'pokemon',
    );
    expect(snippet).toBe('Pokémon means pocket monsters.');
  });

  it('falls back to the first excerpt that has text', async () => {
    const [snippet] = await snippets([
      hit({ excerpts: ['![only a picture](https://cdn.test/a.png)', 'Unrelated words.'] }),
    ]);
    expect(snippet).toBe('Unrelated words.');
  });

  it('keeps the first excerpt when no sentence mentions the search', async () => {
    const [snippet] = await snippets([
      hit({ excerpts: ['Unrelated opening text. More of it.', 'Other text.'] }),
    ]);
    expect(snippet).toBe('Unrelated opening text. More of it.');
  });

  it('treats www, m., old., a trailing slash, a #fragment and utm_ tags as the same page', async () => {
    const results = await snippets([
      hit({ url: 'https://www.reddit.com/r/formula1/x/' }),
      hit({ url: 'https://reddit.com/r/formula1/x#top', excerpts: ['Second copy.'] }),
      hit({ url: 'https://m.reddit.com/r/formula1/x?utm_source=share', excerpts: ['Third.'] }),
      hit({ url: 'https://old.reddit.com/r/formula1/x', excerpts: ['Fourth.'] }),
    ]);
    expect(results).toEqual(['Because the team keeps throwing away wins. See this thread.']);
  });

  it('keeps pages that differ only by a real query parameter', async () => {
    const results = await snippets([
      hit({ url: 'https://www.youtube.com/watch?v=aaa', excerpts: ['One.'] }),
      hit({ url: 'https://www.youtube.com/watch?v=bbb', excerpts: ['Two.'] }),
    ]);
    expect(results).toEqual(['One.', 'Two.']);
  });

  it('drops a copy of the same text on another site, but keeps results with no text', async () => {
    const results = await snippets([
      hit({ url: 'https://a.example.test/post', excerpts: ['Ferrari fans are depressed.'] }),
      hit({ url: 'https://b.example.test/mirror', excerpts: ['Ferrari fans are depressed.'] }),
      hit({ url: 'https://c.example.test/1', excerpts: [] }),
      hit({ url: 'https://d.example.test/2', excerpts: [] }),
    ]);
    expect(results).toEqual(['Ferrari fans are depressed.', '', '']);
  });
});

describe('response shape and caps', () => {
  it('returns text-only results marked device-only, from the provider policy', async () => {
    const { handle } = setup();
    const { status, body } = await read(await handle(request(QUERY)));
    expect(status).toBe(200);
    expect(body).toEqual({
      storage: 'device',
      results: [
        {
          title: 'Why are Ferrari fans always sad?',
          url: 'https://www.reddit.com/r/formula1/comments/abc/why_so_sad/',
          snippet: 'Because the team keeps throwing away wins. See this thread.',
          storage: 'device',
        },
      ],
    });
  });

  it('drops every media field and strips images and HTML from text', async () => {
    const { handle } = setup({
      results: [
        hit({
          image: 'https://cdn.test/a.png',
          images: ['https://cdn.test/b.png'],
          favicon: 'https://cdn.test/favicon.ico',
          video: 'https://cdn.test/v.mp4',
          html: '<img src="https://cdn.test/c.png">',
          content: 'full page text',
          title: '<b>Ferrari</b> &amp; fans',
          excerpts: [
            '![logo](https://cdn.test/d.png) <img src="https://cdn.test/e.png"> <p>Sad <i>fans</i></p>',
          ],
        }),
      ],
    });
    const { body } = await read(await handle(request(QUERY)));
    const [result] = body.results as Record<string, unknown>[];
    expect(Object.keys(result ?? {}).sort()).toEqual(['snippet', 'storage', 'title', 'url']);
    expect(result?.title).toBe('Ferrari & fans');
    expect(result?.snippet).toBe('Sad fans');
    expect(JSON.stringify(body)).not.toMatch(/cdn\.test|\.png|\.mp4|<img|<p>/);
  });

  it('caps results at 10, titles at 120 and snippets at 300 characters', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      hit({
        url: `https://example.test/${i}`,
        title: 'T'.repeat(500),
        excerpts: [`${i} ${'word '.repeat(200)}`],
      }),
    );
    const { handle } = setup({ results: many });
    const { body } = await read(await handle(request(QUERY)));
    const results = body.results as { title: string; snippet: string }[];
    expect(results).toHaveLength(10);
    for (const r of results) {
      expect(r.title.length).toBeLessThanOrEqual(120);
      expect(r.snippet.length).toBeLessThanOrEqual(300);
      expect(r.snippet.endsWith('…')).toBe(true);
    }
  });

  it('keeps its own answer under 16 KB even with long multi-byte text and URLs', async () => {
    const heavy = Array.from({ length: 10 }, (_, i) =>
      hit({
        url: `https://example.test/${i}/${'p'.repeat(2000)}`,
        title: '🏎️'.repeat(200),
        excerpts: [`${i}${'フェラーリ'.repeat(200)}`],
      }),
    );
    const { handle } = setup({ results: heavy });
    const response = await handle(request(QUERY));
    const bytes = new TextEncoder().encode(await response.text()).length;
    expect(response.status).toBe(200);
    expect(bytes).toBeLessThanOrEqual(16 * 1024);
  });

  it('refuses an upstream answer over 256 KB with 502', async () => {
    const huge = { results: [hit({ excerpts: ['x'.repeat(300 * 1024)] })] };
    const { handle } = setup(huge);
    expect(await read(await handle(request(QUERY)))).toEqual({
      status: 502,
      body: { error: 'provider_failed' },
    });
  });

  it('uses the host name for a missing title and an empty snippet for no excerpt', async () => {
    const { handle } = setup({
      results: [hit({ title: null, excerpts: [], url: 'https://knowyourmeme.com/memes/x' })],
    });
    const { body } = await read(await handle(request(QUERY)));
    expect(body.results).toEqual([
      {
        title: 'knowyourmeme.com',
        url: 'https://knowyourmeme.com/memes/x',
        snippet: '',
        storage: 'device',
      },
    ]);
  });

  it('drops a repeated URL', async () => {
    const { handle } = setup({ results: [hit(), hit()] });
    const { body } = await read(await handle(request(QUERY)));
    expect(body.results).toHaveLength(1);
  });

  it.each([
    ['http', 'http://example.test/page'],
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:text/html,hi'],
    ['credentials', 'https://user:pass@example.test/'],
    ['unparsable', 'not a url'],
    ['non-string', 42],
  ])('drops a %s URL', async (_label, url) => {
    const { handle } = setup({ results: [hit({ url }), hit()] });
    const { body } = await read(await handle(request(QUERY)));
    const results = body.results as { url: string }[];
    expect(results.map((r) => r.url)).toEqual([
      'https://www.reddit.com/r/formula1/comments/abc/why_so_sad/',
    ]);
  });

  it('answers 502 when the body has no results list', async () => {
    const { handle } = setup({ nope: true });
    expect(await read(await handle(request(QUERY)))).toEqual({
      status: 502,
      body: { error: 'provider_failed' },
    });
  });
});

describe('errors', () => {
  it('answers 503 when the Parallel key is missing, without calling Parallel', async () => {
    vi.stubEnv('PARALLEL_API_KEY', '');
    const { fetchMock, handle } = setup();
    expect(await read(await handle(request(QUERY)))).toEqual({
      status: 503,
      body: { error: 'not_configured' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps upstream 500 to 502 and upstream 429 to 429', async () => {
    const failing = unlocked(async () => upstream({}, 500));
    expect((await read(await failing(request(QUERY)))).status).toBe(502);
    const limited = unlocked(async () => upstream({}, 429));
    expect(await read(await limited(request(QUERY)))).toEqual({
      status: 429,
      body: { error: 'rate_limited' },
    });
  });

  it('maps a network failure and invalid JSON to 502', async () => {
    const offline = unlocked(async () => {
      throw new TypeError('fetch failed');
    });
    expect((await offline(request(QUERY))).status).toBe(502);
    const garbled = unlocked(async () => new Response('<html>', { status: 200 }));
    expect((await garbled(request(QUERY))).status).toBe(502);
  });

  it('answers 502 when Parallel does not answer before the timeout', async () => {
    vi.useFakeTimers();
    const hanging = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const abort = () => reject(new DOMException('aborted', 'AbortError'));
          init?.signal?.addEventListener('abort', abort);
        }),
    );
    const handle = createHandler({ fetch: hanging, timeoutMs: 8000, checkAccess: () => 'ok' });
    const pending = handle(request(QUERY));
    await vi.advanceTimersByTimeAsync(8000);
    expect(await read(await pending)).toEqual({ status: 502, body: { error: 'provider_failed' } });
  });

  it('refuses cross-site requests but allows same-origin and header-less ones', async () => {
    const { fetchMock, handle } = setup();
    const cross = await handle(request(QUERY, { 'Sec-Fetch-Site': 'cross-site' }));
    expect(cross.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await handle(request(QUERY, { 'Sec-Fetch-Site': 'same-origin' }))).status).toBe(200);
    expect((await handle(request(QUERY))).status).toBe(200);
  });
});

describe('daily cap', () => {
  it('stops calling Parallel once the cap is used, and resets the next UTC day', async () => {
    let now = new Date('2026-11-16T23:59:00Z');
    const { fetchMock, handle } = setup(undefined, { dailyCap: 2, now: () => now });
    expect((await handle(request(QUERY))).status).toBe(200);
    expect((await handle(request(QUERY))).status).toBe(200);
    expect(await read(await handle(request(QUERY)))).toEqual({
      status: 429,
      body: { error: 'daily_cap' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    now = new Date('2026-11-17T00:00:01Z');
    expect((await handle(request(QUERY))).status).toBe(200);
  });
});

describe('headers and logging', () => {
  it('sends JSON, no-store and no CORS allow header on success and on errors', async () => {
    const { handle } = setup();
    const responses = [
      await handle(request(QUERY)),
      await handle(request('a')),
      await createHandler()(request(QUERY)),
    ];
    vi.stubEnv('PARALLEL_API_KEY', '');
    responses.push(await handle(request(QUERY)));
    for (const response of responses) {
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    }
  });

  it('never logs the query, the key or the cookie on any path', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const token = issueToken(ACCESS, Date.now());
    const cookie = { Cookie: `${COOKIE_NAME}=${token}` };
    const paths = [
      createHandler({ fetch: async () => upstream({ results: [hit()] }) }),
      createHandler({ fetch: async () => upstream({}, 500) }),
      createHandler({ fetch: async () => upstream({}, 429) }),
      createHandler({
        fetch: async () => {
          throw new Error(`failed for ${QUERY}`);
        },
      }),
      createHandler({ fetch: async () => new Response('not json') }),
    ];
    for (const handle of paths) {
      await handle(request(QUERY, cookie));
      await handle(request(QUERY));
    }
    vi.stubEnv('PARALLEL_API_KEY', '');
    await paths[0]?.(request(QUERY, cookie));
    const logged = spies.flatMap((spy) => spy.mock.calls.flat().map(String)).join('\n');
    expect(logged).not.toContain('ferrari');
    expect(logged).not.toContain(DUMMY_KEY);
    expect(logged).not.toContain(token);
  });
});
