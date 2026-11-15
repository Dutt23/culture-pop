import { describe, expect, it } from 'vitest';
import { makeAlias, makeInterpretation, makeReference } from '../test/factories';
import { filterByCategory, groupByEra, seededShuffle } from './discovery';
import { externalSearchLinks } from './externalSearch';
import { relatedReferences } from './related';
import { DEFAULT_SETTINGS, parseSettings } from './settings';
import { describeStorageError } from './storageErrors';
import { summarizeByReference } from './summaries';

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
    expect(describeStorageError({ name: 'OpenFailedError', inner: { name: 'VersionError' } })).toMatch(
      /newer version/,
    );
  });

  it('handles non-error values', () => {
    expect(describeStorageError(undefined)).toMatch(/failed to open/);
  });
});

describe('externalSearchLinks', () => {
  it('URL-encodes user input', () => {
    const [wikipedia, web] = externalSearchLinks(' rock & roll? ');
    expect(wikipedia.href).toBe('https://en.wikipedia.org/w/index.php?search=rock%20%26%20roll%3F');
    expect(web.href).toBe('https://duckduckgo.com/?q=rock%20%26%20roll%3F');
  });
});
