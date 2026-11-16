import MiniSearch from 'minisearch';
import { describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../data/seed';
import { isFuzzyMatch, MATCH_RANK, rankByTiers, rankReferences } from './ranking';

const { references, aliases } = buildSeed();
const ids = (query: string) =>
  rankReferences(query, references, aliases).map((m) => m.reference.id);

describe('rankReferences with typo tolerance', () => {
  it('finds a reference from a misspelled title or alias', () => {
    expect(ids('bazingaa')).toEqual(['bazinga-big-bang-theory']);
    expect(ids('ok bomer')).toEqual(['ok-boomer']);
    expect(ids('homer simson')).toEqual(['doh-simpsons']);
  });

  it('finds a reference whose title has swapped letters, by sound', () => {
    expect(ids('bzainga')).toEqual(['bazinga-big-bang-theory']);
    expect(ids('this is fien')).toEqual(['this-is-fine-dog']);
    expect(ids('lte it go').sort()).toEqual(['let-it-go-frozen', 'let-it-go-saying']);
  });

  it('shows both meanings of a misspelled ambiguous phrase', () => {
    expect(ids('hakuna matatta').sort()).toEqual([
      'hakuna-matata-lion-king',
      'hakuna-matata-swahili',
    ]);
  });

  it('keeps the tier results first and in their own order', () => {
    for (const query of ['let it go', 'hakuna matata', 'winter', 'the']) {
      const tiers = rankByTiers(query, references, aliases);
      expect(rankReferences(query, references, aliases).slice(0, tiers.length)).toEqual(tiers);
    }
  });

  it('labels what only a typo or a sound finds, and lists it after every tier match', () => {
    const typo = rankReferences('bazingaa', references, aliases);
    expect(typo.map((m) => m.kind)).toEqual(['typo']);
    const sound = rankReferences('this is fien', references, aliases);
    expect(sound.map((m) => m.kind)).toEqual(['sound']);
    // A tier match and a typo-only match for the same query: tier first.
    const mixed = rankReferences('let it goo', references, aliases);
    const kinds = mixed.map((m) => m.kind);
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds).toEqual([...kinds].sort((a, b) => MATCH_RANK[a] - MATCH_RANK[b]));
  });

  it('does not match a lone short word by sound or typo', () => {
    // "ice" still reaches "Office" through the tiers' substring match; the point is that no
    // typo or sound-alike match is added on top of it.
    for (const query of ['ice', 'out', 'eat', 'sew']) {
      const fuzzy = rankReferences(query, references, aliases).filter(isFuzzyMatch);
      expect(fuzzy, query).toEqual([]);
    }
  });

  it('returns nothing for words that are not close to any title or alias', () => {
    for (const query of [
      'xylophone',
      'quantum physics lecture',
      'cat',
      'zzz',
      'pizza recipe',
      'bazaar',
      'boomerang',
      'weather tomorrow',
    ]) {
      expect(ids(query), query).toEqual([]);
    }
  });

  it('builds its index once per library array, however many searches run', () => {
    const build = vi.spyOn(MiniSearch.prototype, 'addAll');
    const library = [...references];
    for (const query of ['b', 'ba', 'baz', 'bazi', 'bazinga'])
      rankReferences(query, library, aliases);
    expect(build).toHaveBeenCalledTimes(1);
    // A new array (the library changed) is indexed again.
    rankReferences('bazinga', [...references], aliases);
    expect(build).toHaveBeenCalledTimes(2);
    build.mockRestore();
  });

  it('is deterministic', () => {
    expect(ids('let it goo')).toEqual(ids('let it goo'));
  });
});
