import { describe, expect, it } from 'vitest';
import { makeAlias, makeInterpretation, makeReference } from '../test/factories';
import { formatDate, savedOn } from './dates';
import { fromWorks } from './labels';
import {
  discoverable,
  emptyCategories,
  eraOf,
  filterByCategory,
  filterOptions,
  groupByCategory,
  groupByEra,
  matchesFilter,
  NO_FILTER,
  seededShuffle,
  surprisePool,
} from './discovery';
import { externalSearchLinks } from './externalSearch';
import { CATEGORIES, emptyCategoryNote, matchReason, SEARCH_HINT, surpriseNote } from './labels';
import { relatedReferences } from './related';
import { DEFAULT_SETTINGS, parseSettings } from './settings';
import { describeStorageError } from './storageErrors';
import { summarizeByReference } from './summaries';
import { listOf } from './text';

describe('summarizeByReference', () => {
  it('counts meanings and never uses a spoiler as the teaser', () => {
    const summaries = summarizeByReference([
      makeInterpretation('r.1', 'r', { spoiler: 'major', summary: 'SPOILER' }),
      makeInterpretation('r.2', 'r', { summary: 'Safe' }),
      makeInterpretation('s.1', 's', { spoiler: 'major', summary: 'SPOILER' }),
    ]);
    expect(summaries.get('r')).toEqual({ meaningsCount: 2, teaser: 'Safe' });
    expect(summaries.get('s')).toEqual({ meaningsCount: 1, teaser: undefined });
  });
});

describe('relatedReferences', () => {
  it('finds other meanings through shared aliases and same-era picks', () => {
    const song = makeReference('song', 'Let it go (song)', { decade: '2010s+' });
    const saying = makeReference('saying', 'Let it go (saying)');
    const meme = makeReference('meme', 'A meme', { decade: '2010s+' });
    const aliases = [makeAlias('song', 'let it go'), makeAlias('saying', 'let it go')];

    const related = relatedReferences(song, [song, saying, meme], aliases);

    expect(related.otherMeanings.map((r) => r.id)).toEqual(['saying']);
    expect(related.groups.map((g) => [g.kind, g.references.map((r) => r.id)])).toEqual([
      ['era', ['meme']],
    ]);
  });
});

describe('discovery helpers', () => {
  const refs = [
    makeReference('a', 'A', { category: 'meme', decade: '2010s+' }),
    makeReference('b', 'B', { category: 'saying' }),
    makeReference('c', 'C', { category: 'cartoon', decade: '1990s' }),
  ];

  it('groups by era in canonical order and omits empty eras', () => {
    expect(groupByEra(refs).map((g) => g.era)).toEqual(['1990s', '2010s+', 'timeless']);
  });

  it('filters by category', () => {
    expect(filterByCategory(refs, 'meme').map((r) => r.id)).toEqual(['a']);
    expect(filterByCategory(refs, 'all')).toHaveLength(3);
  });

  it('files an online reference under its sourced year, though it has no editorial decade', () => {
    const online = makeReference('wd:Q1', 'Doctor Doom', {
      category: 'comics',
      year: 1962,
      editorialState: 'source_curated',
    });
    expect(groupByEra([online, ...refs]).map((g) => g.era)).toEqual([
      'earlier',
      '1990s',
      '2010s+',
      'timeless',
    ]);
  });

  it('orders each era by title, like the type view, whatever order the references came in', () => {
    const zed = makeReference('z', 'Zed', { decade: '1990s' });
    const alpha = makeReference('a', 'Alpha', { decade: '1990s' });
    const mid = makeReference('m', 'Mid', { year: 1995 });
    expect(groupByEra([zed, mid, alpha])[0].references.map((r) => r.id)).toEqual(['a', 'm', 'z']);
  });

  it('shuffles deterministically per seed without mutating the input', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const snapshot = [...items];
    const first = seededShuffle(items, 42);
    expect(seededShuffle(items, 42)).toEqual(first);
    expect([...first].sort((x, y) => x - y)).toEqual(snapshot);
    expect(items).toEqual(snapshot);
  });
});

describe('browse by type', () => {
  const refs = [
    makeReference('z', 'Zed', { category: 'meme' }),
    makeReference('b', 'Beta', { category: 'comics' }),
    makeReference('a', 'Alpha', { category: 'comics', year: 1962 }),
    makeReference('c', 'Cee', { category: 'cartoon' }),
  ];

  it('groups by category in canonical order, each in title order, omitting empty ones', () => {
    expect(groupByCategory(refs).map((g) => [g.category, g.references.map((r) => r.id)])).toEqual([
      ['cartoon', ['c']],
      ['comics', ['a', 'b']],
      ['meme', ['z']],
    ]);
  });

  it('lists the browsable categories with nothing in them, in canonical order, never "other"', () => {
    expect(emptyCategories(refs)).toEqual([
      'anime',
      'games',
      'film',
      'tv',
      'catchphrase',
      'music',
      'saying',
    ]);
    expect(emptyCategories([])).toEqual(CATEGORIES);
  });

  it('has a search hint for every browsable category, in the same words', () => {
    for (const category of CATEGORIES) {
      expect(SEARCH_HINT[category]).toMatch(/^Search an? [^,]+, like .+, to find one\.$/);
    }
    expect(SEARCH_HINT.games).toBe('Search a game, like Among Us, to find one.');
    expect(SEARCH_HINT.meme).toBe('Search a meme, like 6-7, to find one.');
  });

  it('writes one line per empty category from its hint', () => {
    expect(emptyCategoryNote('games')).toBe(
      'No games yet. Search a game, like Among Us, to find one.',
    );
    expect(emptyCategoryNote('tv')).toBe(
      'No TV yet. Search a series, like Breaking Bad, to find one.',
    );
  });

  it('draws a surprise from the chosen category, or from everything when it is empty', () => {
    const comics = surprisePool(refs, 'comics');
    expect(comics.pool.map((r) => r.id)).toEqual(['b', 'a']);
    expect(comics.fellBack).toBe(false);
    expect(surprisePool(refs, 'all')).toEqual({ pool: refs, fellBack: false });
    expect(surprisePool(refs, 'games')).toEqual({ pool: refs, fellBack: true });
  });

  it('shuffles a filtered pool the same way for the same seed', () => {
    const order = (seed: number) =>
      seededShuffle(surprisePool(refs, 'comics').pool, seed).map((r) => r.id);
    expect(order(7)).toEqual(order(7));
    expect([...order(7)].sort()).toEqual(['a', 'b']);
  });
});

describe('what Discover shows', () => {
  const demo = makeReference('demo', 'Demo');
  const online = (id: string, editorialState: 'source_curated' | 'retrieved' = 'source_curated') =>
    makeReference(id, id, { editorialState });
  const none = new Set<string>();
  const ids = (list: readonly { id: string }[]) => list.map((r) => r.id);

  it('always shows the library entries', () => {
    expect(ids(discoverable([demo], none, none))).toEqual(['demo']);
  });

  it('shows an explained online reference only once it was opened or favourited', () => {
    const refs = [demo, online('wd:Q1'), online('wd:Q2'), online('wd:Q3')];
    expect(ids(discoverable(refs, none, none))).toEqual(['demo']);
    expect(ids(discoverable(refs, new Set(['wd:Q1']), new Set(['wd:Q3'])))).toEqual([
      'demo',
      'wd:Q1',
      'wd:Q3',
    ]);
  });

  it('never shows a Wikiquote page or an unexplained result, opened or favourited', () => {
    const refs = [online('enwikiquote:9'), online('wd:Q5', 'retrieved')];
    const both = new Set(['enwikiquote:9', 'wd:Q5']);
    expect(discoverable(refs, both, both)).toEqual([]);
  });
});

describe('surpriseNote', () => {
  const library = [makeReference('a', 'A')];
  const withOnline = [
    ...library,
    makeReference('wd:Q1', 'B', { editorialState: 'source_curated' }),
  ];

  it('says it is random and not a trend', () => {
    expect(surpriseNote(library, 'all', false)).toBe(
      'A random pick from your library, not a trend.',
    );
  });

  it('mentions what you opened online only when the pool holds online references', () => {
    expect(surpriseNote(withOnline, 'all', false)).toBe(
      "A random pick from your library and what you've opened online, not a trend.",
    );
  });

  it('names the chosen category', () => {
    expect(surpriseNote(library, 'comics', false)).toBe('A random pick from Comics, not a trend.');
  });

  it('says when it fell back to everything', () => {
    expect(surpriseNote(library, 'comics', true)).toBe(
      'Nothing in Comics yet, so this is a random pick from everything.',
    );
  });
});

describe('parseSettings', () => {
  it('uses defaults for missing, unknown and invalid rows', () => {
    expect(
      parseSettings([
        { key: 'theme', value: 'dark' },
        { key: 'motion', value: 'turbo' },
        { key: 'history', value: 'on' },
      ]),
    ).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' });
  });

  it('defaults to spoiler-free', () => {
    expect(parseSettings([]).spoilers).toBe('hide');
  });

  it('leans to taste by default, reads Off, and ignores an invalid value', () => {
    expect(parseSettings([]).taste).toBe('on');
    expect(parseSettings([{ key: 'taste', value: 'off' }]).taste).toBe('off');
    expect(parseSettings([{ key: 'taste', value: 'maybe' }]).taste).toBe('on');
  });

  it('never reads the stored search tags row as a setting', () => {
    expect(parseSettings([{ key: 'searchTags', value: '{"types":["anime"]}' }])).toEqual(
      DEFAULT_SETTINGS,
    );
  });
});

describe('describeStorageError', () => {
  it.each([
    ['VersionError', /newer version/],
    ['UpgradeError', /Nothing was deleted/],
    ['QuotaExceededError', /out of storage/],
    ['MissingAPIError', /blocking local storage/],
    ['SomethingElse', /failed to open/],
  ])('explains %s', (name, expected) => {
    expect(describeStorageError({ name })).toMatch(expected);
  });

  it('unwraps Dexie OpenFailedError', () => {
    expect(
      describeStorageError({ name: 'OpenFailedError', inner: { name: 'VersionError' } }),
    ).toMatch(/newer version/);
  });

  it('handles non-error values', () => {
    expect(describeStorageError(undefined)).toMatch(/failed to open/);
  });
});

describe('externalSearchLinks', () => {
  const links = externalSearchLinks(' rock & roll? ').flatMap((g) => g.links);

  it('URL-encodes user input into every link', () => {
    expect(links.find((l) => l.site === 'Wikipedia')?.href).toBe(
      'https://en.wikipedia.org/w/index.php?search=rock%20%26%20roll%3F',
    );
    expect(links.find((l) => l.site === 'Know Your Meme')?.href).toBe(
      'https://knowyourmeme.com/search?q=rock%20%26%20roll%3F',
    );
    for (const link of links)
      expect(link.href).toMatch(/^https:\/\/[^/]+\/.*rock%20%26%20roll%3F$/);
  });

  it('groups sites so memes, shows and general searches stay separate', () => {
    expect(externalSearchLinks('x').map((g) => g.label)).toEqual([
      'Encyclopedias and quotes',
      'Memes and slang',
      'Shows, films and anime',
      'Music and videos',
      'Anything else',
    ]);
  });

  it('opens YouTube on its videos-only filter', () => {
    expect(links.find((l) => l.site === 'YouTube')?.href).toBe(
      'https://www.youtube.com/results?sp=EgIQAQ%3D%3D&search_query=rock%20%26%20roll%3F',
    );
  });
});

describe('matchReason', () => {
  const ref = makeReference('r', 'Let It Go (Frozen)');
  it.each([
    ['exact_title', 'Let It Go (Frozen)', 'Exact title'],
    ['exact_alias', 'let it go', 'Also known as \u201clet it go\u201d'],
    ['title_prefix', 'Let It Go (Frozen)', 'Starts with your search'],
    ['partial', 'Let It Go (Frozen)', 'Possible match'],
    ['in_message', 'let it go', 'Found \u201clet it go\u201d in your text'],
  ] as const)('%s → %s', (kind, matchedPhrase, expected) => {
    expect(matchReason({ reference: ref, kind, matchedPhrase })).toBe(expected);
  });
});

describe('search filters', () => {
  const film1999 = makeReference('m', 'The Matrix', { category: 'film', year: 1999 });
  const cartoon1993 = makeReference('s', 'SWAT Kats', { category: 'cartoon', year: 1993 });
  const oldFilm = makeReference('o', 'Casablanca', { category: 'film', year: 1942 });
  const saying = makeReference('p', 'Break a leg', { category: 'saying' });

  it('prefers a sourced year over the editorial decade', () => {
    expect(eraOf({ year: 2004, decade: '1990s' })).toBe('2000s');
    expect(eraOf({ decade: '1990s' })).toBe('1990s');
    expect(eraOf({ year: 1942 })).toBe('earlier');
    expect(eraOf({})).toBe('timeless');
  });

  it('filters by category and era together', () => {
    const items = [film1999, cartoon1993, oldFilm, saying];
    expect(items.filter((i) => matchesFilter(i, NO_FILTER))).toHaveLength(4);
    expect(items.filter((i) => matchesFilter(i, { category: 'film', era: 'all' }))).toEqual([
      film1999,
      oldFilm,
    ]);
    expect(items.filter((i) => matchesFilter(i, { category: 'all', era: '1990s' }))).toEqual([
      film1999,
      cartoon1993,
    ]);
  });

  it('offers only options that leave something to show, in canonical order', () => {
    expect(filterOptions([saying, film1999, cartoon1993, oldFilm])).toEqual({
      categories: ['cartoon', 'film', 'saying'],
      eras: ['earlier', '1990s', 'timeless'],
    });
  });
});

describe('formatDate', () => {
  it('formats en-GB and returns undefined, never throwing, for an invalid date', () => {
    // Local noon, so the day is the same in every time zone.
    expect(formatDate('2026-11-15T12:00:00')).toBe('15 Nov 2026');
    expect(formatDate('not a date')).toBeUndefined();
  });
});

describe('savedOn', () => {
  it('says "Saved <date>", and nothing for an invalid date', () => {
    expect(savedOn('2026-11-15T12:00:00')).toBe('Saved 15 Nov 2026');
    expect(savedOn('not a date')).toBeUndefined();
  });
});

describe('listOf', () => {
  it('joins names in plain English, with no serial comma', () => {
    expect(listOf(['Stan Lee'])).toBe('Stan Lee');
    expect(listOf(['Jack Kirby', 'Stan Lee'])).toBe('Jack Kirby and Stan Lee');
    expect(listOf(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('fromWorks', () => {
  const work = (qid: string) => ({ qid, label: `Work ${qid}` });
  const base = makeReference('r', 'Red pill');

  it('lists where it appears, then what inspired it, each work once, at most three', () => {
    const reference = {
      ...base,
      presentIn: [work('Q1'), work('Q2')],
      inspiredBy: [work('Q2'), work('Q3'), work('Q4')],
    };
    expect(fromWorks(reference).map((w) => w.qid)).toEqual(['Q1', 'Q2', 'Q3']);
  });

  it('shows a name once when different works share it (the comic and the film)', () => {
    const reference = {
      ...base,
      presentIn: [
        { qid: 'Q1', label: 'Fantastic Four' },
        { qid: 'Q2', label: 'Fantastic Four' },
        { qid: 'Q3', label: 'fantastic four' },
        { qid: 'Q4', label: 'Avengers' },
      ],
    };
    expect(fromWorks(reference).map((w) => w.label)).toEqual(['Fantastic Four', 'Avengers']);
  });

  it('shows a work once when Wikidata gives it under two names', () => {
    const reference = {
      ...base,
      presentIn: [
        { qid: 'Q1', label: 'Fantastic Four' },
        { qid: 'Q1', label: 'F4' },
      ],
    };
    expect(fromWorks(reference).map((w) => w.label)).toEqual(['Fantastic Four']);
  });

  it('is empty when Wikidata names no work', () => {
    expect(fromWorks(base)).toEqual([]);
  });
});
