import { describe, expect, it } from 'vitest';
import { parseWikibaseItems, scoringIds, toRun, wikiquotePageIds } from './report';
import type { EvalCase } from './queries';

const sholay: EvalCase = {
  id: 'T-test',
  query: 'kitne aadmi the',
  reference: 'Sholay',
  meanings: [{ label: 'Sholay', qids: ['Q1'] }],
  category: 'film',
  misremembered: false,
  ambiguous: false,
  indian: true,
  origin: 'coverage',
  status: 'scored',
};

describe('scoringIds', () => {
  it('turns a Wikiquote page into the Wikidata item of that page', () => {
    expect(scoringIds(['enwikiquote:10', 'wd:Q9'], new Map([['10', 'Q1']]))).toEqual([
      'wd:Q1',
      'wd:Q9',
    ]);
  });

  it('leaves a Wikiquote page without an item, and every Wikipedia page, as it is', () => {
    const qids = new Map([['10', 'Q1']]);
    expect(scoringIds(['enwikiquote:11', 'enwiki:10'], qids)).toEqual([
      'enwikiquote:11',
      'enwiki:10',
    ]);
  });

  it('changes nothing when no lookup was made', () => {
    expect(scoringIds(['enwikiquote:10'])).toEqual(['enwikiquote:10']);
  });
});

describe('wikiquotePageIds', () => {
  it('lists only Wikiquote page IDs, without the prefix', () => {
    expect(wikiquotePageIds(['enwikiquote:10', 'wd:Q1', 'enwiki:10', 'enwikiquote:11'])).toEqual([
      '10',
      '11',
    ]);
  });
});

describe('parseWikibaseItems', () => {
  it('reads page ID to item, skipping pages with no item', () => {
    const json = {
      query: {
        pages: [
          { pageid: 10, title: 'Sholay', pageprops: { wikibase_item: 'Q1' } },
          { pageid: 11, title: 'Some page' },
          { pageid: 12, missing: true },
        ],
      },
    };
    expect([...parseWikibaseItems(json)]).toEqual([['10', 'Q1']]);
  });

  it('gives an empty map for an unexpected response', () => {
    expect(parseWikibaseItems(null).size).toBe(0);
    expect(parseWikibaseItems({ query: {} }).size).toBe(0);
  });
});

describe('toRun with Wikiquote items', () => {
  it('counts the Wikiquote page of the right work as the correct top result', () => {
    const ranked = [{ id: 'enwikiquote:10', title: 'Sholay on Wikiquote' }];
    expect(toRun(sholay, 'live', ranked, 5, [], new Map([['10', 'Q1']])).score).toMatchObject({
      rank: 1,
      incorrectTop: false,
    });
  });

  it('still counts a Wikiquote page of another work as wrong', () => {
    const ranked = [{ id: 'enwikiquote:11', title: 'Other on Wikiquote' }];
    expect(toRun(sholay, 'live', ranked, 5, [], new Map([['11', 'Q2']])).score).toMatchObject({
      rank: null,
      incorrectTop: true,
    });
  });
});
