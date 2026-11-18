// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError, type DraftProvider } from './_lib/cardProviders.js';
import type { ModelAnswer } from './_lib/cardPrompt.js';
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
  const inputs: { user: string }[] = [];
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
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

beforeEach(() => {
  vi.stubEnv('PARALLEL_API_KEY', 'test-only-not-a-real-key');
});
afterEach(() => vi.unstubAllEnvs());

describe('draft-card', () => {
  it('refuses a cross-site request', async () => {
    const { handle } = setup();
    const r = await read(
      await handle(post({ search: SEARCH, sources: [wiki] }, { 'Sec-Fetch-Site': 'cross-site' })),
    );
    expect(r).toEqual({ status: 403, body: { error: 'cross_site' } });
  });

  it('asks for the access code when locked', async () => {
    const { handle, inputs } = setup({ checkAccess: () => 'locked' });
    const r = await read(await handle(post({ search: SEARCH, sources: [wiki] })));
    expect(r).toEqual({ status: 401, body: { error: 'locked' } });
    expect(inputs).toHaveLength(0);
  });

  it('refuses 7 sources, 4 web links, 3 tones, an http link and a 201-char search', async () => {
    const { handle, inputs } = setup();
    const webN = (n: number) => ({ ...web, url: `https://a${n}.example.test/p` });
    const bad = [
      { search: SEARCH, sources: Array.from({ length: 7 }, () => wiki) },
      { search: SEARCH, sources: [1, 2, 3, 4].map(webN) },
      { search: SEARCH, sources: [wiki], tones: [tone, tone, tone] },
      { search: SEARCH, sources: [{ ...web, url: 'http://a.example.test/p' }] },
      { search: 'a'.repeat(201), sources: [wiki] },
    ];
    for (const body of bad) {
      expect((await read(await handle(post(body)))).body).toEqual({ error: 'bad_request' });
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
    expect(r.body.promptVersion).toBe('card-draft-v6');
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

  it('counts toward its own daily cap', async () => {
    const { handle } = setup({ dailyCap: 1 });
    const ask = () => handle(post({ search: SEARCH, sources: [wiki] }));
    expect((await ask()).status).toBe(200);
    expect(await read(await ask())).toEqual({ status: 429, body: { error: 'daily_cap' } });
  });
});
