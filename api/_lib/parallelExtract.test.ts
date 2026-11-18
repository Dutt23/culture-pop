import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractPages } from './parallelExtract.js';
import { objective } from './text.js';

const A = 'https://a.example/page';
const B = 'https://b.example/page';
const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const run = (fetchMock: typeof fetch, urls = [A, B], timeoutMs?: number) =>
  extractPages(urls, 'rizz', { fetch: fetchMock, apiKey: 'k', timeoutMs });

afterEach(() => vi.unstubAllEnvs());

describe('extractPages', () => {
  it('asks Extract with the facts objective and the key header', async () => {
    const fetchMock = vi.fn(() => reply({ results: [], errors: [] }));
    await run(fetchMock as unknown as typeof fetch);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.parallel.ai/v1/extract');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(init.headers).toMatchObject({ 'x-api-key': 'k', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      urls: [A, B],
      objective: objective('rizz', 'meaning'),
    });
  });

  it('returns plain text per url', async () => {
    const fetchMock = vi.fn(() =>
      reply({ results: [{ url: A, excerpts: ['**Rizz** is', 'charm.'] }] }),
    );
    const out = await run(fetchMock as unknown as typeof fetch, [A]);
    expect(out.get(A)).toBe('Rizz is charm.');
  });

  it('keeps only the sentences that name the search, so page menus drop out', async () => {
    const fetchMock = vi.fn(() =>
      reply({
        results: [
          {
            url: A,
            excerpts: ['Popular right now. Rizz is charm.', 'Sign up today. People say rizz about flirting.'],
          },
        ],
      }),
    );
    const out = await run(fetchMock as unknown as typeof fetch, [A]);
    expect(out.get(A)).toBe('Rizz is charm. People say rizz about flirting.');
  });

  it('keeps the whole page text when no sentence names the search', async () => {
    const fetchMock = vi.fn(() =>
      reply({ results: [{ url: A, excerpts: ['Charm is attractive.', 'Flirting skills.'] }] }),
    );
    const out = await run(fetchMock as unknown as typeof fetch, [A]);
    expect(out.get(A)).toBe('Charm is attractive. Flirting skills.');
  });

  describe('sentences that name the search', () => {
    /** The text kept for one page whose excerpts are `excerpts`, for `search`. */
    const keptFor = async (search: string, excerpts: string[]) => {
      const fetchMock = vi.fn(() => reply({ results: [{ url: A, excerpts }] }));
      const out = await extractPages([A], search, { fetch: fetchMock as unknown as typeof fetch, apiKey: 'k' });
      return out.get(A);
    };

    it('ignores punctuation in the search and the page', async () => {
      expect(await keptFor('ok boomer?', ['Popular now. People said OK, boomer and left. Sign up.'])).toBe(
        'People said OK, boomer and left.',
      );
    });

    it('splits Hindi text on the danda and matches Devanagari words', async () => {
      expect(await keptFor('कितने आदमी थे?', ['मेनू देखें। गब्बर ने पूछा कितने आदमी थे। साइन अप करें॥'])).toBe(
        'गब्बर ने पूछा कितने आदमी थे।',
      );
    });

    it('matches a one-word search only as a whole word', async () => {
      expect(await keptFor('ok', ['I read a book. She said ok and left.'])).toBe('She said ok and left.');
    });

    it('is case-insensitive', async () => {
      expect(await keptFor('Rizz', ['Menu. RIZZ IS CHARM.'])).toBe('RIZZ IS CHARM.');
    });

    it('skips a run of over 400 characters even when it names the search', async () => {
      const menu = `Rizz ${'menu item '.repeat(45)}end.`;
      expect(await keptFor('rizz', [menu, 'Rizz is charm.'])).toBe('Rizz is charm.');
    });

    it('keeps the page text as it came when nothing names the search', async () => {
      expect(await keptFor('ok boomer', ['A cookbook. Nothing here.'])).toBe('A cookbook. Nothing here.');
    });
  });

  it('matches a url Parallel returns in normalised form', async () => {
    const raw = 'https://c.example';
    const fetchMock = vi.fn(() =>
      reply({ results: [{ url: 'https://c.example/', excerpts: ['x'] }] }),
    );
    const out = await run(fetchMock as unknown as typeof fetch, [raw]);
    expect(out.get(raw)).toBe('x');
  });

  it("returns null for a url Parallel couldn't read", async () => {
    const fetchMock = vi.fn(() =>
      reply({
        results: [{ url: A, excerpts: [] }],
        errors: [{ url: B, error_type: 'fetch_error' }],
      }),
    );
    const out = await run(fetchMock as unknown as typeof fetch, [A, B, 'https://gone.example']);
    expect([...out.entries()]).toEqual([
      [A, null],
      [B, null],
      ['https://gone.example', null],
    ]);
  });

  it('returns null for every url when the call fails or times out', async () => {
    const failing = [
      vi.fn(() => reply({}, 500)),
      vi.fn(() => Promise.reject(new Error('network'))),
      vi.fn(() => Promise.resolve(new Response('not json'))),
      // Valid JSON that would yield text for A, but is over the 256 KB cap.
      vi.fn(() =>
        reply({ results: [{ url: A, excerpts: ['Rizz is charm.'] }], pad: 'x'.repeat(300 * 1024) }),
      ),
    ];
    for (const f of failing) {
      const out = await run(f as unknown as typeof fetch);
      expect([...out.values()]).toEqual([null, null]);
    }
    const hang = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    const out = await run(hang as unknown as typeof fetch, [A, B], 20);
    expect([...out.values()]).toEqual([null, null]);
  });

  it('gives canned text and no network call under WEB_SEARCH_FAKE', async () => {
    vi.stubEnv('WEB_SEARCH_FAKE', '1');
    vi.stubEnv('VERCEL_ENV', '');
    const fetchMock = vi.fn();
    const out = await run(fetchMock as unknown as typeof fetch, [A]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out.get(A)).toBe('Local test page for "rizz": no real page was read.');
  });
});
