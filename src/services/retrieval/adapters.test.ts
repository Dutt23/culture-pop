import { describe, expect, it } from 'vitest';
import { classify } from './classify';
import { externalLink, pickExternalLinks } from './externalLinks';
import { RetrievalError, type GetJson } from './types';
import { parseTvmazeSearch, tvmazeSearchUrl } from './tvmaze';
import { compactText, htmlToText, safeUrl, throwIfMediaWikiError } from './validate';
import { parseWikidataFacts, wikidataFactsUrl } from './wikidata';
import { parseWikipediaSearch, searchWikipedia, wikipediaSearchUrl } from './wikipedia';
import {
  firstEnglishDefinition,
  lookUpWiktionary,
  parseWiktionary,
  wiktionaryUrl,
} from './wiktionary';
import swatKatsWikidata from './fixtures/wikidata-swat-kats.json';
import matrixWikidata from './fixtures/wikidata-the-matrix.json';
import matrixWikipedia from './fixtures/wikipedia-the-matrix.json';
import hakunaWiktionary from './fixtures/wiktionary-hakuna-matata.json';
import missingWiktionary from './fixtures/wiktionary-missing.json';
import okBoomerWiktionary from './fixtures/wiktionary-ok-boomer.json';
import swatKatsTvmaze from './fixtures/tvmaze-swat-kats.json';
import taarakMehtaTvmaze from './fixtures/tvmaze-taarak-mehta.json';
import catchMeOutsideWikiquote from './fixtures/wikiquote-catch-me-outside.json';
import breakPointTvmaze from './fixtures/tvmaze-break-point.json';
import pointBreakWikiquote from './fixtures/wikiquote-point-break.json';
import whatsUpDocWikiquote from './fixtures/wikiquote-whats-up-doc.json';
import pointBreakWiktionary from './fixtures/wiktionary-point-break.json';
import { parseWikiquoteSearch, wikiquoteSearchUrl } from './wikiquote';

describe('wikipedia', () => {
  it('builds an anonymous CORS search URL with the query encoded', () => {
    const url = new URL(wikipediaSearchUrl('rock & roll'));
    expect(url.origin).toBe('https://en.wikipedia.org');
    expect(url.searchParams.get('origin')).toBe('*');
    expect(url.searchParams.get('gsrsearch')).toBe('rock & roll');
  });

  it('parses recorded results in search order, flagging disambiguation pages', () => {
    const hits = parseWikipediaSearch(matrixWikipedia);
    expect(hits.map((h) => h.title)).toEqual([
      'The Matrix',
      'The Matrix (franchise)',
      'The Matrix Revolutions',
      'The Matrix Resurrections',
      'Matrix',
    ]);
    expect(hits[0]).toMatchObject({ qid: 'Q83495', isDisambiguation: false });
    expect(hits[0].url).toBe('https://en.wikipedia.org/wiki/The_Matrix');
    expect(hits[0].extract).toMatch(/1999/);
    expect(hits[4].isDisambiguation).toBe(true);
  });

  it('drops pages whose link points anywhere but Wikipedia', () => {
    const hostile = {
      query: {
        pages: [
          { pageid: 1, title: 'Evil', fullurl: 'javascript:alert(1)', index: 1 },
          { pageid: 2, title: 'Elsewhere', fullurl: 'https://evil.example/wiki/X', index: 2 },
          { pageid: 3, title: 'Fine', fullurl: 'https://en.wikipedia.org/wiki/Fine', index: 3 },
        ],
      },
    };
    expect(parseWikipediaSearch(hostile).map((h) => h.title)).toEqual(['Fine']);
  });

  it('returns nothing for malformed or empty responses', () => {
    expect(parseWikipediaSearch(null)).toEqual([]);
    expect(parseWikipediaSearch({ batchcomplete: true })).toEqual([]);
  });
});

describe('wikidata', () => {
  it('only interpolates valid Wikidata IDs into the query', () => {
    const query = new URL(wikidataFactsUrl(['Q1', 'Q2 } DROP', 'x'])).searchParams.get('query');
    expect(query).toContain('VALUES ?item { wd:Q1 }');
    expect(query).not.toContain('DROP');
    expect(query).toContain('wdt:P6839');
  });

  it('collects external IDs of known properties only', () => {
    const ids = parseWikidataFacts(matrixWikidata).get('Q83495')?.externalIds;
    expect(ids?.get('P6839')).toEqual(new Set(['Film/TheMatrix']));
    expect(ids?.get('P6262')?.has('matrix:The_Matrix')).toBe(true);

    const binding = (property: string) => ({
      item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q1' },
      idProperty: { type: 'uri', value: property },
      externalId: { type: 'literal', value: 'x' },
    });
    const facts = parseWikidataFacts({
      results: {
        bindings: [
          binding('http://www.wikidata.org/prop/direct/P1234'),
          binding('http://evil.example/prop/direct/P6839'),
        ],
      },
    });
    expect(facts.get('Q1')?.externalIds.size).toBe(0);
  });

  it('reads creator and first-appearance labels, refusing unsafe ones', () => {
    const doom = 'http://www.wikidata.org/entity/Q430178';
    const row = (key: string, value: string) => ({
      item: { type: 'uri', value: doom },
      [key]: { 'xml:lang': 'en', type: 'literal', value },
    });
    const facts = parseWikidataFacts({
      results: {
        bindings: [
          row('creatorLabel', 'Stan Lee'),
          row('creatorLabel', 'Jack Kirby'),
          row('creatorLabel', 'Stan Lee'),
          row('creatorLabel', 'line\nbreak'),
          row('creatorLabel', 'x'.repeat(121)),
          row('firstAppearanceLabel', 'Fantastic Four #5'),
        ],
      },
    }).get('Q430178');
    expect([...(facts?.creators ?? [])]).toEqual(['Stan Lee', 'Jack Kirby']);
    expect(facts?.firstAppearance).toBe('Fantastic Four #5');
  });

  it('reads the works an item appears in (P1441), refusing unsafe items and labels', () => {
    const redPill = 'http://www.wikidata.org/entity/Q1';
    const row = (work: string, label: string | undefined) => ({
      item: { type: 'uri', value: redPill },
      presentIn: { type: 'uri', value: work },
      ...(label === undefined
        ? {}
        : { presentInLabel: { 'xml:lang': 'en', type: 'literal', value: label } }),
    });
    const facts = parseWikidataFacts({
      results: {
        bindings: [
          row('http://www.wikidata.org/entity/Q83495', 'The Matrix'),
          row('http://www.wikidata.org/entity/Q83495', 'The Matrix'),
          row('http://www.wikidata.org/entity/Q2', 'line\nbreak'),
          row('http://www.wikidata.org/entity/Q3', 'x'.repeat(121)),
          // The label service answering with the item's own Q-number is not a label.
          row('http://www.wikidata.org/entity/Q6', 'Q6'),
          // No English label: unbound, so it is not shown as a bare item number.
          row('http://www.wikidata.org/entity/Q4', undefined),
          row('http://evil.example/entity/Q5', 'Not Wikidata'),
          row('http://www.wikidata.org/entity/Qabc', 'Not an item'),
        ],
      },
    }).get('Q1');
    expect([...(facts?.presentIn ?? [])]).toEqual([['Q83495', 'The Matrix']]);
  });

  it('reads the works an item was inspired by (P941), with the same label rules', () => {
    const redPill = 'http://www.wikidata.org/entity/Q7305365';
    const row = (work: string, label: string) => ({
      item: { type: 'uri', value: redPill },
      inspiredBy: { type: 'uri', value: work },
      inspiredByLabel: { 'xml:lang': 'en', type: 'literal', value: label },
    });
    const facts = parseWikidataFacts({
      results: {
        bindings: [
          row('http://www.wikidata.org/entity/Q83495', 'The Matrix'),
          row('http://www.wikidata.org/entity/Q2', 'line\nbreak'),
          row('http://evil.example/entity/Q3', 'Not Wikidata'),
        ],
      },
    }).get('Q7305365');
    expect([...(facts?.inspiredBy ?? [])]).toEqual([['Q83495', 'The Matrix']]);
    expect(facts?.presentIn.size).toBe(0);
  });

  it('asks for the works an item appears in or was inspired by, in the same single request', () => {
    const query = new URL(wikidataFactsUrl(['Q1'])).searchParams.get('query') ?? '';
    expect(query).toContain('?item wdt:P1441 ?presentIn');
    expect(query).toContain('?presentIn rdfs:label ?presentInLabel');
    expect(query).toContain('?item wdt:P941 ?inspiredBy');
    expect(query).toContain('?inspiredBy rdfs:label ?inspiredByLabel');
  });

  it('asks for creators and first appearance with English labels only', () => {
    const query = new URL(wikidataFactsUrl(['Q430178'])).searchParams.get('query') ?? '';
    expect(query).toContain('?item wdt:P170 ?creator');
    expect(query).toContain('?item wdt:P4584 ?firstAppearance');
    expect(query).toContain('wikibase:language "en,mul"');
  });

  it('collects classes and the earliest sourced year per item', () => {
    const facts = parseWikidataFacts(matrixWikidata);
    expect(facts.get('Q83495')).toMatchObject({ year: 1999 });
    expect([...(facts.get('Q83495')?.classes ?? [])]).toContain('Q11424');
    // The franchise matches no queried class and has no date, but still has external IDs.
    expect(facts.get('Q13014087')?.classes.size).toBe(0);
    expect(facts.get('Q13014087')?.year).toBeUndefined();
    expect(parseWikidataFacts(swatKatsWikidata).get('Q6596209')?.classes.has('Q13406463')).toBe(
      true,
    );
  });

  it('classifies an animated series as a cartoon, not plain TV', () => {
    const facts = parseWikidataFacts(swatKatsWikidata).get('Q2077112');
    expect(facts?.year).toBe(1993);
    expect(classify(facts?.classes ?? new Set())).toEqual({ category: 'cartoon', kind: 'work' });
  });

  // Classes as the SPARQL query returns them for these items (checked live 2026-11-15).
  it.each([
    ['Doctor Doom', ['Q1114461', 'Q95074'], { category: 'comics', kind: 'character' }],
    ['Watchmen', ['Q1004'], { category: 'comics', kind: 'work' }],
    ['Mario', ['Q1569167', 'Q95074'], { category: 'games', kind: 'character' }],
    ['Minecraft', ['Q7889'], { category: 'games', kind: 'work' }],
    ['The Legend of Zelda', ['Q7058673'], { category: 'games', kind: 'work' }],
    ['a fictional character outside comics', ['Q95074'], { category: 'other', kind: 'character' }],
    // Checked live 2026-11-17: anime series and films also carry the animated and film classes.
    ['Cowboy Bebop', ['Q1107', 'Q581714', 'Q5398426'], { category: 'anime', kind: 'work' }],
    ['Akira', ['Q1107', 'Q202866', 'Q11424'], { category: 'anime', kind: 'work' }],
    ['Avatar: The Last Airbender', ['Q581714', 'Q5398426'], { category: 'cartoon', kind: 'work' }],
    ['Naruto (filed as manga)', ['Q1004'], { category: 'comics', kind: 'work' }],
  ])('classes %s', (_name, classes, expected) => {
    expect(classify(new Set(classes))).toEqual(expected);
  });

  it('falls back to other for unknown classes', () => {
    expect(classify(new Set(['Q5']))).toEqual({ category: 'other', kind: 'other' });
  });
});

describe('external links', () => {
  it.each([
    ['P13484', 'ok-boomer', 'Know Your Meme', 'https://knowyourmeme.com/memes/ok-boomer'],
    ['P6760', '458', 'Know Your Meme', 'https://knowyourmeme.com/memes/458'],
    [
      'P6839',
      'JustForFun/Rickroll',
      'TV Tropes',
      'https://tvtropes.org/pmwiki/pmwiki.php/JustForFun/Rickroll',
    ],
    [
      'P13553',
      'ok boomer',
      'Urban Dictionary',
      'https://www.urbandictionary.com/define.php?term=ok%20boomer',
    ],
    ['P4086', '5114', 'MyAnimeList', 'https://myanimelist.net/anime/5114'],
    ['P8729', '5114', 'AniList', 'https://anilist.co/anime/5114'],
    [
      'P6262',
      'muppet:Kermit_the_Frog',
      'Fandom',
      'https://community.fandom.com/wiki/w:c:muppet:Kermit_the_Frog',
    ],
    ['P5905', '4005-1234', 'Comic Vine', 'https://comicvine.gamespot.com/wd/4005-1234/'],
    ['P5621', '1009281', 'Marvel.com', 'https://www.marvel.com/comics/characters/1009281/wd'],
    ['P9851', 'harley-quinn', 'DC', 'https://www.dccomics.com/characters/harley-quinn'],
    ['P14738', '2321', 'Grand Comics Database', 'https://www.comics.org/character/2321/'],
    ['P3589', '1234', 'Grand Comics Database', 'https://www.comics.org/series/1234/'],
    ['P4087', '2', 'MyAnimeList', 'https://myanimelist.net/manga/2'],
    ['P8731', '30002', 'AniList', 'https://anilist.co/manga/30002'],
  ])('builds the %s link for %s', (property, id, label, url) => {
    expect(externalLink(property, id)).toEqual({ label, url });
  });

  it.each([
    ['P13484', 'javascript:alert(1)'],
    ['P13484', '../admin'],
    ['P6760', '35/../x'],
    ['P6839', 'Film/../../evil'],
    ['P6839', 'Film/TheMatrix/Extra'],
    ['P6839', '//evil.example/x'],
    ['P13553', '<script>'],
    ['P13553', 'a?b=c'],
    ['P4086', '12a'],
    ['P8729', '-1'],
    ['P6262', 'https://evil.example/x'],
    ['P6262', 'matrix:a/../../../x'],
    ['P6262', 'es.sherlockholmes:James_Moriarty'],
    ['P6262', 'matrix:The Matrix'],
    ['P5905', '4099-1'],
    ['P5905', '4005-1/../x'],
    ['P9851', 'Harley-Quinn'],
    ['P14738', '0'],
    ['P9999', '1'],
  ])('rejects %s ID %j', (property, id) => {
    expect(externalLink(property, id)).toBeUndefined();
  });

  it('keeps one link per site, skipping invalid IDs, in display order', () => {
    const ids = new Map([
      ['P6262', new Set(['movies:The_Matrix', 'bad id', 'matrix:The_Matrix'])],
      ['P6760', new Set(['35'])],
      ['P13484', new Set(['../x', 'ok-boomer'])],
    ]);
    expect(pickExternalLinks(ids)).toEqual([
      { label: 'Know Your Meme', url: 'https://knowyourmeme.com/memes/ok-boomer' },
      { label: 'Fandom', url: 'https://community.fandom.com/wiki/w:c:matrix:The_Matrix' },
    ]);
  });
});

describe('wiktionary', () => {
  it('asks for the lowercase and as-typed titles in one request', () => {
    const titles = new URL(wiktionaryUrl('OK Boomer')).searchParams.get('titles');
    expect(titles).toBe('ok boomer|OK Boomer');
  });

  it('extracts the first English definition from a recorded entry', () => {
    expect(parseWiktionary(hakunaWiktionary)).toEqual({
      title: 'hakuna matata',
      url: 'https://en.wiktionary.org/wiki/hakuna_matata',
      definition: 'No worries, take it easy.',
    });
  });

  it('treats pointer-only entries and missing pages as no definition', () => {
    expect(parseWiktionary(okBoomerWiktionary)).toBeUndefined();
    expect(parseWiktionary(missingWiktionary)).toBeUndefined();
  });

  it('skips a headword line that lists inflections', () => {
    expect(parseWiktionary(pointBreakWiktionary)?.definition).toBe(
      '(surfing slang) The location where a wave breaks as it hits a point of land jutting out from the coastline.',
    );
  });

  it('ignores non-English sections', () => {
    const extract = '== Swahili ==\n=== Phrase ===\nfoo\n\nSwahili meaning.\n';
    expect(firstEnglishDefinition(extract, 'foo')).toBeUndefined();
  });
});

describe('MediaWiki errors reported as HTTP 200', () => {
  const error = (code: string) => ({ error: { code, info: 'Details' } });

  async function failureOf(promise: Promise<unknown>): Promise<string> {
    try {
      await promise;
    } catch (caught) {
      if (caught instanceof RetrievalError) return caught.failure;
      throw caught;
    }
    throw new Error('Expected a RetrievalError');
  }

  it.each([
    ['ratelimited', 'rate_limited'],
    ['maxlag', 'rate_limited'],
    ['badvalue', 'bad_response'],
  ])('maps code %s to %s', async (code, failure) => {
    expect(await failureOf(Promise.resolve(error(code)).then(throwIfMediaWikiError))).toBe(failure);
  });

  it('passes ordinary and malformed responses through', () => {
    expect(() => throwIfMediaWikiError(matrixWikipedia)).not.toThrow();
    expect(() => throwIfMediaWikiError(null)).not.toThrow();
    expect(() => throwIfMediaWikiError({ error: 'not an object' })).not.toThrow();
  });

  it('fails a Wikipedia search instead of returning no results', async () => {
    const getJson: GetJson = async () => error('ratelimited');
    expect(await failureOf(searchWikipedia('the matrix', getJson))).toBe('rate_limited');
  });

  it('fails a Wiktionary lookup instead of returning no definition', async () => {
    const getJson: GetJson = async () => error('internal_api_error_DBQueryError');
    expect(await failureOf(lookUpWiktionary('hakuna matata', getJson))).toBe('bad_response');
  });
});

describe('wikiquote', () => {
  it('builds an anonymous CORS exact-phrase search URL', () => {
    const url = new URL(wikiquoteSearchUrl('point "break'));
    expect(url.origin).toBe('https://en.wikiquote.org');
    expect(url.searchParams.get('origin')).toBe('*');
    expect(url.searchParams.get('srsearch')).toBe('"point  break"');
  });

  it('keeps pages that quote the phrase, with just the quoting sentence', () => {
    const hits = parseWikiquoteSearch(pointBreakWikiquote, 'point break');
    expect(hits.map((h) => h.title)).toEqual([
      'Thor: Ragnarok',
      'Hot Fuzz',
      'Robot Chicken: Star Wars Episode III',
    ]);
    expect(hits[0]).toMatchObject({
      url: 'https://en.wikiquote.org/wiki/Thor%3A_Ragnarok',
      quote: 'Point Break.',
    });
    expect(hits[2].quote).toBe('"Point break," bitches!');
    expect(hits.every((h) => h.quote.length <= 160 && !/[<>]|&#/.test(h.quote))).toBe(true);
  });

  it("drops the work's own page and list pages, which don't quote it", () => {
    const titles = parseWikiquoteSearch(pointBreakWikiquote, 'point break').map((h) => h.title);
    expect(titles).not.toContain('Point Break');
    expect(titles).not.toContain('List of films (P–S)');
  });

  it('finds nothing when no page has the exact phrase', () => {
    // shortcut: an exact-phrase search misses spellings without the apostrophe ("whats").
    expect(parseWikiquoteSearch(whatsUpDocWikiquote, 'whats up doc')).toEqual([]);
    expect(parseWikiquoteSearch(catchMeOutsideWikiquote, 'catch me outside')).toEqual([]);
  });

  it('strips tags (decoded entities stay plain text) and drops malformed results', () => {
    const hostile = {
      query: {
        search: [
          {
            pageid: 1,
            title: 'Villains',
            snippet: 'Hi. So evil <img src=x onerror=alert(1)> &lt;b&gt;!',
          },
          { pageid: 2, title: 'Evil', snippet: 'evil' },
          { pageid: 3, title: 'List of villains', snippet: 'evil' },
          { pageid: '4', title: 'Villains', snippet: 'evil' },
          { pageid: 5, snippet: 'evil' },
        ],
      },
    };
    const hits = parseWikiquoteSearch(hostile, 'evil');
    expect(hits).toEqual([
      {
        pageId: 1,
        title: 'Villains',
        url: 'https://en.wikiquote.org/wiki/Villains',
        quote: 'So evil <b>!',
      },
    ]);
    expect(parseWikiquoteSearch(null, 'evil')).toEqual([]);
  });
});

describe('tvmaze', () => {
  it('builds a search URL with the query encoded', () => {
    expect(tvmazeSearchUrl('rock & roll')).toBe(
      'https://api.tvmaze.com/search/shows?q=rock+%26+roll',
    );
  });

  it('reads type, premiere year and network from recorded results', () => {
    expect(parseTvmazeSearch(swatKatsTvmaze, 'SWAT Kats: The Radical Squadron')[0]).toMatchObject({
      id: 15796,
      name: 'Swat Kats: The Radical Squadron',
      url: 'https://www.tvmaze.com/shows/15796/swat-kats-the-radical-squadron',
      isAnimation: true,
      year: 1993,
      network: 'TBS',
    });
    const [taarak] = parseTvmazeSearch(taarakMehtaTvmaze, 'taarak mehta');
    expect(taarak).toMatchObject({ isAnimation: false, year: 2008, network: 'Sony SAB' });
    expect(taarak.summary).not.toMatch(/[<>]/);
  });

  it('keeps only shows whose name contains the phrase', () => {
    // TVmaze answers "Break Point" with its "Point Break" series too.
    expect(parseTvmazeSearch(breakPointTvmaze, 'Break Point').map((s) => s.name)).toEqual([
      'Break Point',
    ]);
  });

  it('drops off-site links, bad IDs, bad dates and weak matches', () => {
    const show = (overrides: Record<string, unknown>) => ({
      score: 0.9,
      show: { id: 1, name: 'Show', url: 'https://www.tvmaze.com/shows/1/show', ...overrides },
    });
    const parsed = parseTvmazeSearch(
      [
        show({ url: 'javascript:alert(1)' }),
        show({ url: 'https://evil.example/shows/1' }),
        show({ id: '1' }),
        show({ id: 1.5 }),
        { score: 0.1, show: show({}).show },
        show({ name: 'Another' }),
        show({ premiered: '93-09-11', summary: '<script>x</script>Fine' }),
      ],
      'show',
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].year).toBeUndefined();
    expect(parsed[0].summary).toBe('xFine');
    expect(parseTvmazeSearch({ error: 'nope' }, 'show')).toEqual([]);
  });
});

describe('htmlToText', () => {
  it('strips tags, keeps paragraph breaks as spaces and decodes entities', () => {
    expect(htmlToText('<p>One</p><p>Two &amp; &quot;three&quot; &#039;four&#x27;</p>')).toBe(
      ' One  Two & "three" \'four\' ',
    );
    expect(htmlToText('<span class="searchmatch">What&#039;s</span> up')).toBe("What's up");
    expect(htmlToText('bad &#0; &#99999999; &bogus; ok')).toBe('bad  &#99999999; &bogus; ok');
  });
});

describe('validate', () => {
  it('accepts only https URLs on the expected host', () => {
    expect(safeUrl('https://en.wikipedia.org/wiki/A', 'en.wikipedia.org')).toBe(
      'https://en.wikipedia.org/wiki/A',
    );
    expect(safeUrl('http://en.wikipedia.org/wiki/A', 'en.wikipedia.org')).toBeUndefined();
    expect(safeUrl('not a url', 'en.wikipedia.org')).toBeUndefined();
    expect(safeUrl('https://other.org/wiki/A', 'en.wikipedia.org')).toBeUndefined();
  });

  it('refuses a link with a username or password, as the page would at render time', () => {
    expect(safeUrl('https://user:pw@en.wikipedia.org/wiki/A', 'en.wikipedia.org')).toBeUndefined();
    expect(safeUrl('https://user@en.wikipedia.org/wiki/A', 'en.wikipedia.org')).toBeUndefined();
  });

  it('caps long text at a word boundary', () => {
    expect(compactText('one two three four', 9)).toBe('one two…');
    expect(compactText('  spaced \n out  ')).toBe('spaced out');
  });
});
