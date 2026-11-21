// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError, type DraftProvider } from './_lib/cardProviders.js';
import {
  PROMPT_VERSION,
  TOPIC_PREFIX,
  TOPIC_PROMPT_VERSION,
  type ModelAnswer,
} from './_lib/cardPrompt.js';
import { createDraftHandler, type DraftHandlerOptions } from './draft-card.js';

const SEARCH = 'kitne aadmi the';
const PAGE_URL = 'https://www.example.test/sholay-lines';
const WIKI_TEXT =
  'In Sholay, the villain Gabbar asks how many men there were. It is a famous scene.';
const PAGE_TEXT =
  'People quote "Kitne aadmi the" for a headcount. More at https://other.example.test/x today.';

const ANSWER: ModelAnswer = {
  main_use: 'quote',
  label: 'Kitne aadmi the',
  gist: 'A line from Sholay.',
  means: 'They want a headcount.',
  reply: 'Bas teen, Gabbar!',
  summary: [{ t: 'Gabbar asks how many men there were.', ids: ['E1'] }],
  context: [],
  example: null,
  spoiler: 'none',
  unclear: false,
  ignored: [],
};

const wiki = { kind: 'wiki', from: 'wikipedia', title: 'Sholay', text: WIKI_TEXT };
const web = { kind: 'web', from: 'example.test', title: 'Lines', url: PAGE_URL, text: 'x' };
const tone = { label: 'a', gist: 'b', means: 'c', reply: 'd', summary: 'e' };

function fakeProvider(answer: unknown = ANSWER) {
  const inputs: { user: string; prefix: string; promptVersion?: string }[] = [];
  const provider: DraftProvider = {
    name: 'fake',
    draft: async (input) => {
      inputs.push(input);
      return answer;
    },
  };
  return { provider, inputs };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://app.example.test/api/draft-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const extractFetch = (text: string | null) =>
  vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({ results: text === null ? [] : [{ url: PAGE_URL, excerpts: [text] }] }),
      ),
  );

function setup(options: DraftHandlerOptions = {}, answer?: unknown) {
  const fake = fakeProvider(answer);
  const handle = createDraftHandler({
    checkAccess: () => 'ok',
    providers: [fake.provider],
    fetch: extractFetch(PAGE_TEXT),
    ...options,
  });
  return { handle, inputs: fake.inputs };
}

async function read(response: Response) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests walk nested JSON fields
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

beforeEach(() => {
  vi.stubEnv('PARALLEL_API_KEY', 'test-only-not-a-real-key');
});
afterEach(() => vi.unstubAllEnvs());

describe('draft-card fan-made evidence', () => {
  const FANON_URL = 'https://charactersfanon.fandom.com/wiki/Weaver';
  const fanon = { kind: 'web', from: 'x', title: 'Weaver', url: FANON_URL, text: 'fanon snippet' };
  const bothPages = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          results: [
            { url: PAGE_URL, excerpts: [PAGE_TEXT] },
            { url: FANON_URL, excerpts: ['The Weaver wants to kill everyone on the planet.'] },
          ],
        }),
      ),
  );

  it('never shows the model a fanon site and reports it as not used', async () => {
    const answer = {
      ...ANSWER,
      summary: [{ t: 'People quote Kitne aadmi the for a headcount.', ids: ['E1'] }],
    };
    const { handle, inputs } = setup({ fetch: bothPages }, answer);
    const { status, body } = await read(
      await handle(post({ search: SEARCH, kind: 'list', sources: [web, fanon] })),
    );
    expect(status).toBe(200);
    expect(inputs[0].user).not.toContain('Weaver');
    expect(body.notUsed).toContainEqual({ source: 1, why: 'fan-made site, not the original work' });
  });

  it('keeps an ordinary page from the same kind of request', async () => {
    const { handle, inputs } = setup({ fetch: bothPages });
    await handle(post({ search: SEARCH, kind: 'list', sources: [web, fanon] }));
    expect(inputs[0].user).toContain('headcount');
  });
});

describe('draft-card', () => {
  it('sends late matching web evidence and its work to the topic model within the source cap', async () => {
    const page =
      'Other characters fight in unrelated stories. '.repeat(80) +
      'Vegeta serves Frieza in Dragon Ball Z. He conquers planets for sale. ' +
      'Vegeta committed genocide on multiple planets, not just one.';
    const { handle, inputs } = setup({ fetch: extractFetch(page) });
    await handle(post({ search: 'genocidal maniacs', kind: 'list', sources: [web] }));
    expect(inputs).toHaveLength(1);
    expect(inputs[0].user).toContain('Dragon Ball Z');
    expect(inputs[0].user).toContain(
      'Vegeta committed genocide on multiple planets, not just one.',
    );
    expect(inputs[0].user).not.toContain('Other characters fight');
  });

  it('anchors long-page selection to the picked result instead of a stronger unrelated query match', async () => {
    const selected = 'Frieza exterminated the Saiyan race in Dragon Ball Z.';
    const page =
      `${selected} Frieza invented an account of the Saiyan homeworld being destroyed by meteors. ` +
      'Unrelated character fights a rival. '.repeat(80) +
      'Live-action characters are genocidal maniacs. These genocidal maniacs appear in another franchise.';
    const { handle, inputs } = setup({ fetch: extractFetch(page) });
    await handle(
      post({
        search: 'genocidal maniacs',
        kind: 'list',
        about: ['anime', 'cartoons'],
        sources: [{ ...web, text: selected }],
      }),
    );
    expect(inputs[0].user).toContain(selected);
    expect(inputs[0].user).not.toContain('Live-action characters');
  });

  it('keeps ten readable topic sources within the larger evidence budget', async () => {
    const { handle, inputs } = setup();
    const sources = [
      wiki,
      ...Array.from({ length: 9 }, (_, index) => ({
        ...wiki,
        title: `Source ${index}`,
        text: `Character${index} `.repeat(90),
      })),
    ];
    const result = await read(await handle(post({ search: SEARCH, kind: 'list', sources })));
    expect(inputs).toHaveLength(1);
    expect(inputs[0].user).toContain('evidence[10]');
    expect(result.body.notUsed).not.toContainEqual(
      expect.objectContaining({ why: 'over the length limit' }),
    );
  });

  it('selects the dedicated topic prefix and independent response version', async () => {
    const { handle, inputs } = setup();
    const result = await read(
      await handle(post({ search: SEARCH, kind: 'list', sources: [wiki] })),
    );
    expect(result.status).toBe(200);
    expect(inputs[0].prefix).toBe(TOPIC_PREFIX);
    expect(inputs[0].promptVersion).toBe(TOPIC_PROMPT_VERSION);
    expect(result.body.promptVersion).toBe(TOPIC_PROMPT_VERSION);
    expect(inputs[0].user).toContain('source_index');
  });
  it('validates retry indices and carries user provenance and context independently', async () => {
    const { handle, inputs } = setup();
    for (const retry of [
      { preserveSources: [-1] },
      { preserveSources: [1] },
      { preserveSources: ['0'] },
      null,
    ]) {
      expect(
        (await read(await handle(post({ search: SEARCH, sources: [wiki], retry })))).status,
      ).toBe(400);
    }
    const result = await read(
      await handle(
        post({
          search: SEARCH,
          kind: 'topic',
          sources: [{ ...wiki, provenance: 'user' }],
          userContext: 'My own interpretation',
          retry: { preserveSources: [0] },
        }),
      ),
    );
    expect(result.status).toBe(200);
    expect(inputs[0].user).toContain('My own interpretation');
    expect(inputs[0].user).toContain('unverified context; not evidence');
    expect(inputs[0].user).toContain('requested_source_indices[1]: 0');
  });

  it('validates and bounds custom style guidance before sending it to the provider', async () => {
    const { handle, inputs } = setup();
    for (const styleGuidance of [null, 'casual', { tone: 'casual' }, { tone: 4, structure: '' }]) {
      expect(
        (await read(await handle(post({ search: SEARCH, sources: [wiki], styleGuidance })))).status,
      ).toBe(400);
    }
    expect(inputs).toHaveLength(0);
    const result = await read(
      await handle(
        post({
          search: SEARCH,
          sources: [wiki],
          styleGuidance: {
            tone: 'x'.repeat(300),
            structure: 'Brief summary then examples https://private.example.test',
          },
        }),
      ),
    );
    expect(result.status).toBe(200);
    expect(inputs[0].user).toContain('style_guidance:');
    expect(inputs[0].user).toContain(`${'x'.repeat(279)}…`);
    expect(inputs[0].user).not.toContain('x'.repeat(281));
    expect(inputs[0].user).not.toContain('private.example.test');
    expect(inputs[0].user).toContain('Brief summary then examples');
  });

  it('refuses a cross-site request', async () => {
    const { handle } = setup();
    const r = await read(
      await handle(post({ search: SEARCH, sources: [wiki] }, { 'Sec-Fetch-Site': 'cross-site' })),
    );
    expect(r).toEqual({ status: 403, body: { error: 'cross_site' } });
  });

  it.each([
    ['signed_out', 401],
    ['not_allowed', 403],
    ['unavailable', 503],
  ] as const)('refuses %s with %i and asks no model', async (access, status) => {
    const { handle, inputs } = setup({ checkAccess: async () => access });
    const r = await read(await handle(post({ search: SEARCH, sources: [wiki] })));
    expect(r).toEqual({ status, body: { error: access } });
    expect(inputs).toHaveLength(0);
  });

  it('refuses 11 sources, 11 web links, 3 tones, an http link and a 201-char search', async () => {
    const { handle, inputs } = setup();
    const webN = (n: number) => ({ ...web, url: `https://a${n}.example.test/p` });
    const bad = [
      { search: SEARCH, sources: Array.from({ length: 11 }, () => wiki) },
      { search: SEARCH, sources: Array.from({ length: 11 }, (_, n) => webN(n)) },
      { search: SEARCH, sources: [wiki], tones: [tone, tone, tone] },
      { search: SEARCH, sources: [{ ...web, url: 'http://a.example.test/p' }] },
      { search: 'a'.repeat(201), sources: [wiki] },
    ];
    for (const body of bad) {
      expect(await read(await handle(post(body)))).toEqual({
        status: 400,
        body: { error: 'bad_request' },
      });
    }
    expect(inputs).toHaveLength(0);
  });

  it('extracts only web sources and sends no URL to the model', async () => {
    const fetchMock = extractFetch(PAGE_TEXT);
    const { handle, inputs } = setup({ fetch: fetchMock });
    const r = await read(await handle(post({ search: SEARCH, sources: [wiki, web] })));
    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).urls).toEqual([PAGE_URL]);
    expect(inputs[0]?.user).toContain('Kitne aadmi the');
    expect(inputs[0]?.user).not.toContain('http');

    fetchMock.mockClear();
    await handle(post({ search: SEARCH, sources: [wiki] }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists a link Parallel couldn't read as not used and drafts from the rest", async () => {
    const { handle } = setup({ fetch: extractFetch(null) });
    const r = await read(await handle(post({ search: SEARCH, sources: [wiki, web] })));
    expect(r.status).toBe(200);
    expect(r.body.notUsed).toEqual([{ source: 1, why: "couldn't be read" }]);
  });

  it('uses the reader snippet when Parallel cannot read a page and it is long enough', async () => {
    const snippet = `Everyone says "${SEARCH}" when they want a headcount of people.`;
    const { handle, inputs } = setup({ fetch: extractFetch(null) });
    const r = await read(
      await handle(post({ search: SEARCH, sources: [wiki, { ...web, text: snippet }] })),
    );
    expect(r.body.notUsed).toEqual([]);
    expect(inputs[0]?.user).toContain('headcount of people');
  });

  it('drops an off-topic source before the model and reports it', async () => {
    const offTopic = {
      kind: 'wiki',
      from: 'wikipedia',
      title: 'Soup',
      text: 'Soup is a primarily liquid food, generally served warm or hot in a bowl.',
    };
    const { handle, inputs } = setup();
    const r = await read(await handle(post({ search: SEARCH, sources: [wiki, offTopic] })));
    expect(r.body.notUsed).toEqual([{ source: 1, why: 'mentions none of the search words' }]);
    expect(inputs[0]?.user).not.toContain('Soup');
  });

  it('returns the checked card with source indices and the provider name', async () => {
    const { handle } = setup();
    const r = await read(await handle(post({ search: SEARCH, sources: [web, wiki] })));
    expect(r.status).toBe(200);
    expect(r.body.provider).toBe('fake');
    expect(r.body.promptVersion).toBe(PROMPT_VERSION);
    expect(r.body.card.summary).toEqual([
      { text: 'Gabbar asks how many men there were.', sources: [1] },
    ]);
  });

  it('returns no_card when the model says unclear', async () => {
    const { handle } = setup({}, { ...ANSWER, unclear: true });
    const r = await read(await handle(post({ search: SEARCH, sources: [wiki] })));
    expect(r).toEqual({
      status: 422,
      body: { error: 'no_card', reason: 'unclear', notUsed: [] },
    });
  });

  it('returns no_card when nothing is left after curation', async () => {
    const { handle, inputs } = setup({ fetch: extractFetch(null) });
    const r = await read(await handle(post({ search: SEARCH, sources: [web] })));
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ reason: 'nothing_left' });
    expect(inputs).toHaveLength(0);
  });

  it('returns out_of_credit when every provider is out of credit', async () => {
    const broke: DraftProvider = {
      name: 'openai',
      draft: async () => {
        throw new ProviderError('out_of_credit', 'x');
      },
    };
    const { handle } = setup({ providers: [broke] });
    const r = await read(await handle(post({ search: SEARCH, sources: [wiki] })));
    expect(r).toEqual({ status: 503, body: { error: 'out_of_credit' } });
  });

  it('answers 429 daily_cap from the shared count and asks no model', async () => {
    const { handle, inputs } = setup({ checkAccess: async () => 'daily_cap' as const });
    const r = await read(await handle(post({ search: SEARCH, sources: [wiki] })));
    expect(r).toEqual({ status: 429, body: { error: 'daily_cap' } });
    expect(inputs).toHaveLength(0);
  });

  it('keeps URLs out of titles, tone cards and the search', async () => {
    const { handle, inputs } = setup();
    const r = await read(
      await handle(
        post({
          search: `${SEARCH} https://s.example.test/q`,
          sources: [{ ...wiki, title: 'Sholay https://t.example.test/x' }],
          tones: [{ ...tone, gist: 'see https://tone.example.test/y now' }],
        }),
      ),
    );
    expect(r.status).toBe(200);
    expect(inputs[0]?.user).not.toContain('http');
    expect(inputs[0]?.user).toContain('see now');
    const onlyUrl = post({ search: 'https://only.example.test', sources: [wiki] });
    expect((await handle(onlyUrl)).status).toBe(400);
  });

  it('rejects a wiki or app source whose from is not on the list', async () => {
    const { handle } = setup();
    for (const source of [
      { ...wiki, from: 'evil.example' },
      { kind: 'app', from: 'wikipedia', title: 'Mine', text: WIKI_TEXT },
    ]) {
      expect((await handle(post({ search: SEARCH, sources: [source] }))).status).toBe(400);
    }
  });

  it('drops whole items that would pass the total length limit and lists them', async () => {
    // Distinct words per item, so none is a near-duplicate; ~1,190 characters each.
    const body = (n: number) =>
      `${SEARCH} ${Array.from({ length: 250 }, (_, k) => `w${n}x${k}`).join(' ')}`.slice(0, 1190);
    const froms = ['wiktionary', 'wiktionary', 'wikipedia', 'wikipedia', 'your card', 'your card'];
    const sources = froms.map((from, n) => ({
      kind: from === 'your card' ? 'app' : 'wiki',
      from,
      title: `Item${n}`,
      text: body(n),
    }));
    const answer = { ...ANSWER, summary: [{ t: `${SEARCH} w0x0 w0x1 w0x2.`, ids: ['E1'] }] };
    const { handle, inputs } = setup({}, answer);
    const r = await read(await handle(post({ search: SEARCH, sources })));
    expect(r.status).toBe(200);
    const sent = inputs[0]?.user ?? '';
    expect((sent.match(/w\d+x\d+/g) ?? []).join(' ').length).toBeLessThanOrEqual(6000);
    expect(r.body.notUsed).toEqual([{ source: 5, why: 'over the length limit' }]);
    expect(sent).not.toContain('Item5');
  });

  it('maps provider errors to 429 and 502', async () => {
    const failing = (kind: 'rate_limited' | 'failed'): DraftProvider => ({
      name: 'openai',
      draft: async () => {
        throw new ProviderError(kind, 'x');
      },
    });
    const body = { search: SEARCH, sources: [wiki] };
    const limited = setup({ providers: [failing('rate_limited')] }).handle;
    expect(await read(await limited(post(body)))).toEqual({
      status: 429,
      body: { error: 'rate_limited' },
    });
    const broken = setup({ providers: [failing('failed')] }).handle;
    expect(await read(await broken(post(body)))).toEqual({
      status: 502,
      body: { error: 'provider_failed' },
    });
  });

  it('falls back from a hanging provider and still answers within 23 s', async () => {
    vi.useFakeTimers();
    try {
      const hanging = (name: DraftProvider['name']) => {
        const draft = vi.fn<DraftProvider['draft']>(
          (_input, signal) =>
            new Promise((_, reject) =>
              signal.addEventListener('abort', () => reject(new ProviderError('failed', 'x'))),
            ),
        );
        return { provider: { name, draft } satisfies DraftProvider, draft };
      };
      const first = hanging('openai');
      const second = hanging('cloudflare');
      const { handle } = setup({ providers: [first.provider, second.provider] });
      let settled = false;
      const answer = handle(post({ search: SEARCH, sources: [wiki] })).then((r) => {
        settled = true;
        return r;
      });

      await vi.advanceTimersByTimeAsync(11_000);
      expect(second.draft).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(23_000 - 11_000 - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await read(await answer)).toEqual({ status: 502, body: { error: 'provider_failed' } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('answers 503 not_configured with no providers', async () => {
    const { handle } = setup({ providers: [] });
    expect(await read(await handle(post({ search: SEARCH, sources: [wiki] })))).toEqual({
      status: 503,
      body: { error: 'not_configured' },
    });
  });

  it('refuses a body over 80 KB', async () => {
    const { handle } = setup();
    const big = { search: SEARCH, sources: [wiki], pad: 'x'.repeat(81 * 1024) };
    expect((await handle(post(big))).status).toBe(400);
  });

  it('does not refuse a full body of 4-byte characters within every field cap', async () => {
    const { handle } = setup();
    const c = (n: number) => '𝒜'.repeat(n);
    const sources = Array.from({ length: 10 }, (_, i) => ({
      kind: i < 3 ? 'wiki' : 'app',
      from: i < 3 ? 'wikipedia' : 'app card',
      title: c(200),
      text: `${SEARCH} ${i} ${c(1190)}`,
    }));
    const full = { label: c(280), gist: c(280), means: c(280), reply: c(280), summary: c(280) };
    const body = { search: SEARCH, sources, tones: [full, full] };
    expect(new TextEncoder().encode(JSON.stringify(body)).length).toBeGreaterThan(40 * 1024);
    // Past the size cap and validation; curation then finds no Latin-script evidence (422), not a 400.
    expect((await handle(post(body))).status).not.toBe(400);
  });

  it('refuses duplicate links and a link with credentials', async () => {
    const { handle } = setup();
    const dup = [web, { ...web, title: 'Again' }];
    const creds = [{ ...web, url: 'https://user:pw@www.example.test/p' }];
    for (const sources of [dup, creds]) {
      expect((await handle(post({ search: SEARCH, sources }))).status).toBe(400);
    }
  });

  it('cuts an over-long text and title instead of refusing', async () => {
    const { handle, inputs } = setup();
    const r = await handle(
      post({
        search: SEARCH,
        sources: [{ ...wiki, title: 'T'.repeat(500), text: `${WIKI_TEXT} ${'a '.repeat(2000)}` }],
      }),
    );
    expect(r.status).toBe(200);
    expect(inputs[0]?.user).not.toContain('T'.repeat(201));
  });
});
