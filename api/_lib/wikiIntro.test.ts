// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { leadSentences, readWikiIntros } from './wikiIntro.js';

const GUNDAM =
  'Mobile Suit Gundam (Japanese: 機動戦士ガンダム, Hepburn: Kidō Senshi Gandamu) is a Japanese anime television series created by Yoshiyuki Tomino for Sunrise. It premiered in 1979 and ran for 43 episodes.\nIt follows Amuro Ray, a teenager who pilots the RX-78-2 Gundam in a war between Earth and its space colonies.';

const answer = (query: unknown, ok = true) =>
  vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify({ query }), { status: ok ? 200 : 500 }),
  );

describe('readWikiIntros', () => {
  it('asks Wikipedia once for every title and returns each intro without romanisation asides', async () => {
    const fetchMock = answer({
      pages: [
        { title: 'Mobile Suit Gundam', extract: GUNDAM },
        { title: 'Mobile Suit Gundam SEED', extract: 'Mobile Suit Gundam SEED is a 2002 anime.' },
      ],
    });
    const intros = await readWikiIntros(
      [
        { title: 'Mobile Suit Gundam', description: 'Japanese anime television series' },
        { title: 'Mobile Suit Gundam SEED' },
      ],
      1200,
      { fetch: fetchMock },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.host).toBe('en.wikipedia.org');
    expect(url.searchParams.get('titles')).toBe('Mobile Suit Gundam|Mobile Suit Gundam SEED');
    expect(url.searchParams.get('exintro')).toBe('1');
    expect(intros.get('Mobile Suit Gundam')).toBe(
      'Mobile Suit Gundam is a Japanese anime television series created by Yoshiyuki Tomino for Sunrise. It premiered in 1979 and ran for 43 episodes. It follows Amuro Ray, a teenager who pilots the RX-78-2 Gundam in a war between Earth and its space colonies.',
    );
    expect(intros.get('Mobile Suit Gundam SEED')).toBe('Mobile Suit Gundam SEED is a 2002 anime.');
  });

  it('follows normalised titles and redirects back to the title that was asked for', async () => {
    const intros = await readWikiIntros([{ title: 'gundam wing' }], 1200, {
      fetch: answer({
        normalized: [{ from: 'gundam wing', to: 'Gundam wing' }],
        redirects: [{ from: 'Gundam wing', to: 'Mobile Suit Gundam Wing' }],
        pages: [
          { title: 'Mobile Suit Gundam Wing', extract: 'Gundam Wing is a 1995 mecha anime.' },
        ],
      }),
    });
    expect(intros.get('gundam wing')).toBe('Gundam Wing is a 1995 mecha anime.');
  });

  it('gives null for a missing article, a disambiguation page or a different subject', async () => {
    const intros = await readWikiIntros(
      [
        { title: 'Nope' },
        { title: 'Wing' },
        { title: 'Mercury', description: 'Japanese anime television series' },
      ],
      1200,
      {
        fetch: answer({
          pages: [
            { title: 'Nope', missing: true },
            { title: 'Wing', extract: 'Wing may refer to:', pageprops: { disambiguation: '' } },
            { title: 'Mercury', extract: 'Mercury is the smallest planet in the Solar System.' },
          ],
        }),
      },
    );
    expect([...intros.values()]).toEqual([null, null, null]);
  });

  it('gives null for every title when Wikipedia fails, answers badly or throws', async () => {
    const titles = [{ title: 'A' }, { title: 'B' }];
    const failing = [
      answer({ pages: [{ title: 'A', extract: 'A is a.' }] }, false),
      vi.fn<typeof fetch>(async () => new Response('not json')),
      vi.fn<typeof fetch>(async () => {
        throw new Error('offline');
      }),
    ];
    for (const fetchMock of failing) {
      const intros = await readWikiIntros(titles, 1200, { fetch: fetchMock });
      expect(Object.fromEntries(intros)).toEqual({ A: null, B: null });
    }
  });

  it('makes no request when there is nothing to read', async () => {
    const fetchMock = answer({ pages: [] });
    expect((await readWikiIntros([], 1200, { fetch: fetchMock })).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('leadSentences', () => {
  it('keeps whole sentences that fit and cuts only a too-long first sentence', () => {
    expect(leadSentences('One two. Three four. Five six.', 20)).toBe('One two. Three four.');
    expect(leadSentences('A very long opening sentence.', 10)).toBe('A very lo…');
  });

  it('drops a romanisation aside with brackets inside it but keeps ordinary brackets', () => {
    expect(
      leadSentences(
        "Gundam Wing (Japanese: 新機動戦記ガンダムW(ウイング), Hepburn: Shin Kidō Senki Gandamu Uingu; lit. 'New Mobile Report Gundam Wing'), is a 1995 anime (TV series).",
        1200,
      ),
    ).toBe('Gundam Wing, is a 1995 anime (TV series).');
  });
});
