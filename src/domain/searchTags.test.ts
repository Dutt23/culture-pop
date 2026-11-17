import { describe, expect, it } from 'vitest';
import { makeCandidate, makeReference } from '../test/factories';
import type { RankedMatch } from './ranking';
import {
  aboutHint,
  addCustomTag,
  cleanTag,
  hasActiveTags,
  leanByTaste,
  liftTagged,
  matchesTags,
  MAX_CUSTOM_TAGS,
  NO_TAGS,
  orderChanged,
  parseSearchTags,
  removeCustomTag,
  serializeSearchTags,
  tasteLean,
  tasteNote,
  toggleCustomTag,
  toggleType,
  TYPE_TAGS,
  type SearchTagState,
} from './searchTags';
import type { Category } from './types';

const tags = (state: Partial<SearchTagState>): SearchTagState => ({ ...NO_TAGS, ...state });
const marvel = tags({ custom: [{ text: 'Marvel', on: true }] });

describe('type tags', () => {
  it('offers one tag per browsable category, anime first, never "other"', () => {
    expect(TYPE_TAGS[0]).toBe('anime');
    expect(TYPE_TAGS).not.toContain('other');
    expect(TYPE_TAGS).toHaveLength(10);
  });

  it('turns a type on and off again, keeping canonical order', () => {
    const on = toggleType(toggleType(NO_TAGS, 'music'), 'anime');
    expect(on.types).toEqual(['anime', 'music']);
    expect(toggleType(on, 'anime').types).toEqual(['music']);
  });
});

describe('custom tags', () => {
  it.each([
    ['  Marvel  ', 'Marvel'],
    ['Star   Wars', 'Star Wars'],
    ["Rock 'n' Roll", "Rock 'n' Roll"],
    ['Tom & Jerry', 'Tom & Jerry'],
    ['बॉलीवुड', 'बॉलीवुड'],
  ])('cleans %j to %j', (raw, clean) => {
    expect(cleanTag(raw)).toBe(clean);
  });

  it.each([
    ['x'],
    ['a'.repeat(31)],
    ['<script>'],
    ['https://x.test'],
    ['   '],
    ['🎌🎌'],
    ['&&'],
    ['--'],
  ])('refuses %j', (raw) => {
    expect(cleanTag(raw)).toBeUndefined();
  });

  it('adds a tag switched on, refuses a repeat in any case, and stops at the cap', () => {
    const added = addCustomTag(NO_TAGS, 'Marvel');
    expect(added).toEqual({ ok: true, state: marvel });
    expect(addCustomTag(marvel, 'marvel')).toEqual({ ok: false, reason: 'duplicate' });

    const full = tags({
      custom: Array.from({ length: MAX_CUSTOM_TAGS }, (_, i) => ({ text: `tag ${i}`, on: false })),
    });
    expect(addCustomTag(full, 'One more')).toEqual({ ok: false, reason: 'full' });
    expect(addCustomTag(NO_TAGS, '!')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('turns a type on when the typed tag names one, instead of saving a copy', () => {
    expect(addCustomTag(NO_TAGS, 'Anime')).toEqual({ ok: true, state: tags({ types: ['anime'] }) });
    expect(addCustomTag(NO_TAGS, 'film')).toEqual({ ok: true, state: tags({ types: ['film'] }) });
    expect(addCustomTag(tags({ types: ['anime'] }), 'anime')).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });

  it('switches a tag off without forgetting it, and removes it', () => {
    const off = toggleCustomTag(marvel, 'Marvel');
    expect(off.custom).toEqual([{ text: 'Marvel', on: false }]);
    expect(hasActiveTags(off)).toBe(false);
    expect(removeCustomTag(marvel, 'Marvel')).toEqual(NO_TAGS);
  });
});

describe('stored tags', () => {
  it('reads back what was saved', () => {
    const state = tags({ types: ['anime', 'tv'], custom: [{ text: 'Marvel', on: false }] });
    expect(parseSearchTags(serializeSearchTags(state))).toEqual(state);
  });

  it.each([[undefined], ['not json'], ['null'], ['42'], ['[]']])(
    'falls back to no tags for %j',
    (raw) => {
      expect(parseSearchTags(raw)).toEqual(NO_TAGS);
    },
  );

  it('drops unknown types, bad tags, repeats and anything past the cap', () => {
    const raw = JSON.stringify({
      types: ['tv', 'other', 'opera', 42, 'anime'],
      custom: [
        { text: 'Marvel', on: true },
        { text: 'marvel', on: true },
        { text: '<b>', on: true },
        'Bollywood',
        { text: 'Bollywood', on: 'yes' },
        ...Array.from({ length: 10 }, (_, i) => ({ text: `extra ${i}`, on: true })),
      ],
    });
    const state = parseSearchTags(raw);
    expect(state.types).toEqual(['anime', 'tv']);
    expect(state.custom.slice(0, 2)).toEqual([
      { text: 'Marvel', on: true },
      { text: 'Bollywood', on: false },
    ]);
    expect(state.custom).toHaveLength(MAX_CUSTOM_TAGS);
  });
});

describe('matching', () => {
  it('matches an "on" type by category, never "other"', () => {
    const anime = tags({ types: ['anime'] });
    expect(matchesTags(makeReference('a', 'Akira', { category: 'anime' }), anime)).toBe(true);
    const toyStory = makeReference('b', 'Toy Story', { category: 'cartoon' });
    expect(matchesTags(toyStory, anime)).toBe(false);
  });

  it('matches a custom tag as whole words in what the result is known by', () => {
    const doom = makeReference('d', 'Doctor Doom', {
      category: 'comics',
      creators: ['Stan Lee', 'Jack Kirby'],
    });
    expect(matchesTags(doom, tags({ custom: [{ text: 'Jack Kirby', on: true }] }))).toBe(true);
    expect(matchesTags(doom, marvel, 'A supervillain in Marvel Comics.')).toBe(true);
    expect(matchesTags(doom, marvel)).toBe(false);
    // "Marvelous" is not "Marvel".
    expect(matchesTags(makeReference('m', 'The Marvelous Mrs. Maisel'), marvel)).toBe(false);
  });

  it('reads library tags, "From:" works and the first source sentence of an online result', () => {
    const pokemon = makeReference('p', 'I choose you!', { tags: ['anime'], category: 'cartoon' });
    expect(matchesTags(pokemon, tags({ custom: [{ text: 'Anime', on: true }] }))).toBe(true);
    const pill = makeCandidate({
      id: 'wd:Q1',
      title: 'Red pill and blue pill',
      inspiredBy: [{ qid: 'Q83495', label: 'The Matrix' }],
    });
    expect(matchesTags(pill, tags({ custom: [{ text: 'the matrix', on: true }] }))).toBe(true);
  });

  it('never matches a two-word tag across the end of one field and the start of the next', () => {
    const film = makeReference('s', 'A New Star', { creators: ['Wars Studio'] });
    expect(matchesTags(film, tags({ custom: [{ text: 'Star Wars', on: true }] }))).toBe(false);
  });

  it('ignores a tag that is switched off', () => {
    const off = tags({ custom: [{ text: 'Marvel', on: false }] });
    expect(matchesTags(makeReference('x', 'Marvel Zombies'), off)).toBe(false);
  });
});

describe('lifting', () => {
  const isEven = (n: number) => n % 2 === 0;

  it('puts answers first, then tagged results, then the rest, each in the order given', () => {
    expect(liftTagged([1, 2, 3, 4, 5, 6], isEven, (n) => n === 5)).toEqual([5, 2, 4, 6, 1, 3]);
  });

  it('never removes anything and leaves the input alone', () => {
    const input = [3, 1, 2];
    expect(
      liftTagged(
        input,
        () => false,
        () => false,
      ),
    ).toEqual([3, 1, 2]);
    expect(liftTagged(input, isEven, () => false)).toEqual([2, 3, 1]);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('taste', () => {
  const lean = (...categories: Category[]) => tasteLean(categories);

  it('leans to the most common category once it has three and at least half', () => {
    expect(lean('anime', 'anime', 'anime', 'film', 'tv', 'music')).toBe('anime');
    expect(lean('anime', 'anime', 'film')).toBeUndefined();
    expect(lean('anime', 'anime', 'anime', 'film', 'tv', 'music', 'meme')).toBeUndefined();
  });

  it('never leans on a tie or on "other"', () => {
    expect(lean('anime', 'anime', 'anime', 'film', 'film', 'film')).toBeUndefined();
    expect(lean('other', 'other', 'other', 'other')).toBeUndefined();
    expect(lean('anime', 'anime', 'anime', 'other', 'other', 'other', 'other')).toBe('anime');
    expect(lean()).toBeUndefined();
  });

  const match = (id: string, category: Category, kind: RankedMatch['kind']): RankedMatch => ({
    reference: makeReference(id, id, { category }),
    kind,
    matchedPhrase: id,
  });

  it('breaks ties only within equally good matches', () => {
    const matches = [
      match('exact', 'film', 'exact_title'),
      match('p1', 'film', 'partial'),
      match('p2', 'anime', 'partial'),
      match('typo', 'anime', 'typo'),
    ];
    const ids = (list: RankedMatch[]) => list.map((m) => m.reference.id);
    expect(ids(leanByTaste(matches, 'anime'))).toEqual(['exact', 'p2', 'p1', 'typo']);
    expect(ids(leanByTaste(matches, undefined))).toEqual(['exact', 'p1', 'p2', 'typo']);
  });

  it('never beats a tag: the lift is applied over the leaned order', () => {
    const matches = [
      match('film', 'film', 'partial'),
      match('tv', 'tv', 'partial'),
      match('anime', 'anime', 'partial'),
    ];
    const leaned = leanByTaste(matches, 'anime');
    const lifted = liftTagged(
      leaned,
      (m) => m.reference.category === 'tv',
      () => false,
    );
    expect(lifted.map((m) => m.reference.id)).toEqual(['tv', 'anime', 'film']);
  });

  it('says why only when the order changed', () => {
    const a = match('a', 'film', 'partial');
    const b = match('b', 'anime', 'partial');
    expect(orderChanged([a, b], [b, a])).toBe(true);
    expect(orderChanged([a, b], [a, b])).toBe(false);
    expect(tasteNote('anime', true)).toBe(
      "Anime ranked a little higher because of your favourites and what you've opened.",
    );
    expect(tasteNote('tv', false)).toBe('TV ranked a little higher because of your favourites.');
  });
});

describe('wider-web hint', () => {
  it('names the "on" types, then the "on" custom tags, at most five', () => {
    const state = tags({
      types: ['anime', 'film', 'tv'],
      custom: [
        { text: 'Marvel', on: true },
        { text: 'Off one', on: false },
        { text: 'Bollywood', on: true },
        { text: 'Sixth', on: true },
      ],
    });
    expect(aboutHint(state)).toEqual(['anime', 'film', 'TV', 'Marvel', 'Bollywood']);
    expect(aboutHint(NO_TAGS)).toEqual([]);
  });
});
