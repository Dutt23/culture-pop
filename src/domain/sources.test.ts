import { describe, expect, it } from 'vitest';
import {
  isWikipediaReference,
  isWikiquoteReference,
  PUBLISHER,
  referenceId,
  sourceIdOf,
  tvmazeSourceId,
  wikiquotePageId,
} from './sources';

describe('source names and IDs', () => {
  it('builds the IDs the retrieval adapters have always written', () => {
    expect(referenceId.wikidata('Q83495')).toBe('wd:Q83495');
    expect(referenceId.wikipedia(12345)).toBe('enwiki:12345');
    expect(referenceId.wiktionary('no cap')).toBe('enwiktionary:no cap');
    expect(referenceId.wikiquote(99)).toBe('enwikiquote:99');
    expect(sourceIdOf(referenceId.wikidata('Q1'))).toBe('src:wd:Q1');
    expect(sourceIdOf(referenceId.wikiquote(99))).toBe('src:enwikiquote:99');
    expect(tvmazeSourceId(7)).toBe('src:tvmaze:7');
  });

  it('tells Wikipedia hits and Wikiquote pages apart by ID', () => {
    expect(isWikipediaReference('wd:Q1')).toBe(true);
    expect(isWikipediaReference('enwiki:2')).toBe(true);
    expect(isWikipediaReference('enwiktionary:x')).toBe(false);
    expect(isWikiquoteReference('enwikiquote:3')).toBe(true);
    expect(isWikiquoteReference('wd:Q1')).toBe(false);
    expect(wikiquotePageId('enwikiquote:3')).toBe('3');
    expect(wikiquotePageId('wd:Q1')).toBeUndefined();
  });

  it('names the five publishers', () => {
    expect(Object.values(PUBLISHER)).toEqual([
      'Wikipedia',
      'Wikidata',
      'Wiktionary',
      'Wikiquote',
      'TVmaze',
    ]);
  });
});
