import { describe, expect, it } from 'vitest';
import { makeAlias, makeReference } from '../test/factories';
import { isAmbiguous, rankReferences } from './ranking';

describe('rankReferences', () => {
  it('returns nothing for an empty or punctuation-only query', () => {
    const refs = [makeReference('a', 'Alpha')];
    expect(rankReferences('', refs, [])).toEqual([]);
    expect(rankReferences(' ?! ', refs, [])).toEqual([]);
  });

  it('orders exact title > exact alias > title prefix > alias prefix > partial', () => {
    const refs = [
      makeReference('partial', 'Zebra the go thing'),
      makeReference('alias-prefix', 'Unrelated one'),
      makeReference('title-prefix', 'Go team'),
      makeReference('exact-alias', 'Something else'),
      makeReference('exact-title', 'Go'),
    ];
    const aliases = [makeAlias('exact-alias', 'go'), makeAlias('alias-prefix', 'gone fishing')];

    const kinds = rankReferences('go', refs, aliases).map((m) => [m.reference.id, m.kind]);

    expect(kinds).toEqual([
      ['exact-title', 'exact_title'],
      ['exact-alias', 'exact_alias'],
      ['title-prefix', 'title_prefix'],
      ['alias-prefix', 'alias_prefix'],
      ['partial', 'partial'],
    ]);
  });

  it('keeps every reference that shares an alias and breaks ties by title then id', () => {
    const refs = [
      makeReference('z-id', 'Same title'),
      makeReference('b', 'Beta'),
      makeReference('a-id', 'Same title'),
    ];
    const aliases = refs.map((r) => makeAlias(r.id, 'shared phrase'));

    const ids = rankReferences('Shared Phrase!', refs, aliases).map((m) => m.reference.id);

    expect(ids).toEqual(['b', 'a-id', 'z-id']);
  });

  it('matches regardless of apostrophe style and reports the matched alias', () => {
    const refs = [makeReference('doh', "D'oh! (The Simpsons)")];
    const aliases = [makeAlias('doh', "d'oh")];

    const [match] = rankReferences('D’oh', refs, aliases);

    expect(match.kind).toBe('exact_alias');
    expect(match.matchedPhrase).toBe("d'oh");
  });

  it('matches when every query token prefixes a title or alias token', () => {
    const refs = [makeReference('got', 'Winter is coming (Game of Thrones)')];

    expect(rankReferences('thrones winter', refs, [])).toHaveLength(1);
    expect(rankReferences('thrones summer', refs, [])).toHaveLength(0);
  });

  it('reports the alias when a partial match comes only from an alias', () => {
    const refs = [makeReference('pk', 'I choose you (Pokemon)')];
    const aliases = [makeAlias('pk', 'pikachu i choose you')];

    const [match] = rankReferences('pika', refs, aliases);

    expect(match.kind).toBe('alias_prefix');
    // "pika" only prefixes an alias token, so the alias is what matched.
    expect(rankReferences('choose pika', refs, aliases)[0]).toMatchObject({
      kind: 'partial',
      matchedPhrase: 'pikachu i choose you',
    });
  });

  it('is deterministic regardless of input order', () => {
    const refs = [makeReference('b', 'Let it be'), makeReference('a', 'Let it go')];
    const forward = rankReferences('let', refs, []).map((m) => m.reference.id);
    const reversed = rankReferences('let', [...refs].reverse(), []).map((m) => m.reference.id);
    expect(forward).toEqual(reversed);
  });
});

describe('isAmbiguous', () => {
  it('is true only when more than one reference matches exactly', () => {
    const refs = [makeReference('a', 'Let it go (song)'), makeReference('b', 'Let it go (saying)')];
    const shared = refs.map((r) => makeAlias(r.id, 'let it go'));

    expect(isAmbiguous(rankReferences('let it go', refs, shared))).toBe(true);
    expect(isAmbiguous(rankReferences('let it go', refs, shared.slice(0, 1)))).toBe(false);
    expect(isAmbiguous(rankReferences('let', refs, shared))).toBe(false);
  });
});
