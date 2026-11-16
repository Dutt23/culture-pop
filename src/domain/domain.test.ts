import { describe, expect, it } from 'vitest';
import { makeAlias, makeInterpretation, makeReference } from '../test/factories';
import { formatDate } from './dates';
import {
  eraOf,
  filterByCategory,
  filterOptions,
  groupByEra,
  matchesFilter,
  NO_FILTER,
  seededShuffle,
} from './discovery';
import { externalSearchLinks } from './externalSearch';
import { matchReason } from './labels';
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
    expect(related.sameEra.map((r) => r.id)).toEqual(['meme']);
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

  it('shuffles deterministically per seed without mutating the input', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const snapshot = [...items];
    const first = seededShuffle(items, 42);
    expect(seededShuffle(items, 42)).toEqual(first);
    expect([...first].sort((x, y) => x - y)).toEqual(snapshot);
    expect(items).toEqual(snapshot);
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
      'Anything else',
    ]);
  });
});

describe('matchReason', () => {
  const ref = makeReference('r', 'Let It Go (Frozen)');
  it.each([
    ['exact_title', 'Let It Go (Frozen)', 'Exact title'],
    ['exact_alias', 'let it go', 'Also known as \u201clet it go\u201d'],
    ['title_prefix', 'Let It Go (Frozen)', 'Starts with your search'],
    ['partial', 'Let It Go (Frozen)', 'Possible match'],
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

describe('listOf', () => {
  it('joins names in plain English, with no serial comma', () => {
    expect(listOf(['Stan Lee'])).toBe('Stan Lee');
    expect(listOf(['Jack Kirby', 'Stan Lee'])).toBe('Jack Kirby and Stan Lee');
    expect(listOf(['A', 'B', 'C'])).toBe('A, B and C');
  });
});
