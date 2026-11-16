import { describe, expect, it } from 'vitest';
import { rerankCandidates, scoreCandidate } from './rerank';
import type { RetrievedCandidate } from './types';

function candidate(
  id: string,
  title: string,
  overrides: Partial<RetrievedCandidate> = {},
): RetrievedCandidate {
  return {
    id,
    title,
    kind: 'other',
    category: 'other',
    classifying: false,
    role: 'topic',
    sources: [],
    externalLinks: [],
    ...overrides,
  };
}

const definition = (word: string) =>
  candidate(`enwiktionary:${word}`, word, { kind: 'phrase', role: 'definition' });
const titles = (query: string, list: RetrievedCandidate[]) =>
  rerankCandidates(query, list).map((c) => c.title);

describe('rerankCandidates', () => {
  it('keeps Wikipedia order when nothing else applies', () => {
    const list = [
      candidate('wd:1', 'Alpha'),
      candidate('wd:2', 'Beta'),
      candidate('wd:3', 'Gamma'),
    ];
    expect(titles('unrelated words', list)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('never lifts anything above Wikipedia first hit, an exact title included', () => {
    const list = [
      candidate('wd:1', 'Bhad Bhabie'),
      candidate('wd:2', 'Cash Me Outside (song)', { kind: 'work', role: 'work' }),
    ];
    expect(titles('cash me outside', list)[0]).toBe('Bhad Bhabie');
  });

  it('puts a dictionary entry first when Wikipedia first hit is not an exact title', () => {
    const list = [
      candidate('wd:1', 'Chad (slang)'),
      candidate('wd:2', 'Lake Chad'),
      candidate('wd:3', 'Wojak'),
      definition('gigachad'),
    ];
    expect(titles('gigachad', list)).toEqual(['gigachad', 'Chad (slang)', 'Lake Chad', 'Wojak']);
  });

  it('gives a dictionary entry no bonus when a Wikipedia page is named exactly like the query', () => {
    const list = [
      candidate('wd:1', 'Dune (franchise)', { kind: 'other', role: 'topic' }),
      candidate('wd:2', 'Arrakis'),
      candidate('wd:3', 'Dune (2021 film)', { kind: 'work', role: 'work' }),
      definition('dune'),
    ];
    expect(titles('dune', list)).toEqual([
      'Dune (franchise)',
      'Dune (2021 film)',
      'Arrakis',
      'dune',
    ]);
  });

  it('keeps an exact-title Wikipedia first hit ahead of the dictionary entry', () => {
    const list = [
      candidate('wd:1', 'Scarface (1983 film)', { kind: 'work', role: 'work' }),
      definition('scarface'),
    ];
    expect(titles('scarface', list)).toEqual(['Scarface (1983 film)', 'scarface']);
  });

  it('lets an exact title (disambiguator removed) pass non-exact hits below the first', () => {
    const list = [
      candidate('wd:1', 'First'),
      candidate('wd:2', 'Break Point'),
      candidate('wd:3', 'Point Break (2015 film)', { kind: 'work', role: 'work' }),
    ];
    expect(titles('point break', list)).toEqual([
      'First',
      'Point Break (2015 film)',
      'Break Point',
    ]);
  });

  it('reads a Wikiquote candidate by its page title, not its " on Wikiquote" label', () => {
    const quote = candidate('enwikiquote:9', 'Sholay on Wikiquote', {
      kind: 'quote',
      role: 'quoted_in',
      sources: [
        {
          id: 'src:enwikiquote:9',
          url: 'https://en.wikiquote.org/wiki/Sholay',
          title: 'Sholay',
          publisher: 'Wikiquote',
          sourceType: 'other',
          retrievedAt: '2026-11-16T00:00:00.000Z',
          license: 'CC BY-SA 4.0',
        },
      ],
    });
    expect(scoreCandidate('sholay', quote)).toBeGreaterThan(scoreCandidate('other', quote));
  });

  it('does not change its input and gives the same order every time', () => {
    const list = [candidate('wd:1', 'A'), definition('a'), candidate('wd:2', 'B')];
    const copy = [...list];
    expect(titles('a', list)).toEqual(titles('a', list));
    expect(list).toEqual(copy);
  });

  it('returns an empty list for no candidates', () => {
    expect(rerankCandidates('anything', [])).toEqual([]);
  });

  // Wikipedia's own "did you mean" says the typed spelling is wrong, so its hits outrank the
  // misspelled search's hits at the same place.
  it('puts a spelling suggestion first among hits at the same place', () => {
    const list = [
      candidate('wd:1', 'Harlequin'),
      candidate('wd:2', 'DC Omnibus'),
      candidate('wd:3', 'Harley Quinn', { via: 'suggestion' }),
      candidate('wd:4', 'Birds of Prey (2020 film)', { via: 'suggestion' }),
    ];
    expect(titles('harley quin joker', list)).toEqual([
      'Harley Quinn',
      'Harlequin',
      'Birds of Prey (2020 film)',
      'DC Omnibus',
    ]);
  });

  it('keeps the typed search first when the fallback is only a shorter phrase', () => {
    const list = [
      candidate('wd:1', 'Ferrari fans'),
      candidate('wd:2', 'Scuderia Ferrari', { via: 'shorter_phrase' }),
    ];
    expect(titles('ferrari fans depressed', list)).toEqual(['Ferrari fans', 'Scuderia Ferrari']);
  });
});
