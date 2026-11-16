import { describe, expect, it } from 'vitest';
import { isCacheEligible } from '../../domain/eligibility';
import { relatedReferences } from '../../domain/related';
import type { Reference } from '../../domain/types';
import { makeReference, makeSource } from '../../test/factories';
import { curateReference, draftFor, indefiniteArticle, isClaimSupported } from './curate';

const NOW = '2026-11-15T12:00:00.000Z';

const wikidata = (qid: string) =>
  makeSource(`src:wd:${qid}`, 'Wikidata', { sourceType: 'structured_data' });

function retrieved(id: string, title: string, overrides: Partial<Reference> = {}): Reference {
  return makeReference(id, title, {
    editorialState: 'retrieved',
    kind: 'other',
    category: 'other',
    ...overrides,
  });
}

const matrix = retrieved('wd:Q83495', 'The Matrix', {
  kind: 'work',
  category: 'film',
  year: 1999,
  yearSourceId: 'src:wd:Q83495',
  sourceIds: ['src:enwiki:30007', 'src:wd:Q83495'],
});
const matrixSources = [
  makeSource('src:enwiki:30007', 'Wikipedia', {
    excerpt: 'The Matrix is a 1999 science fiction action film.',
  }),
  wikidata('Q83495'),
];

describe('templates', () => {
  it('original work: type and year, crediting the source that states each', () => {
    const { interpretations, editorialState } = curateReference(matrix, matrixSources, NOW);
    expect(interpretations).toEqual([
      expect.objectContaining({
        id: 'wd:Q83495#original',
        relation: 'original',
        label: 'The work',
        summary: '“The Matrix” is a 1999 film (Wikidata).',
        sourceIds: ['src:wd:Q83495'],
        provenance: 'source_supported',
        evidence: 'supported',
        selection: null,
        spoiler: 'none',
        context: '',
        usageExample: '',
      }),
    ]);
    expect(editorialState).toBe('source_curated');
  });

  it('credits each publisher when the year comes from a different source than the type', () => {
    const show = retrieved('wd:Q1', 'Break Point (2023 TV series)', {
      kind: 'work',
      category: 'tv',
      year: 2023,
      yearSourceId: 'src:tvmaze:7',
      sourceIds: ['src:wd:Q1', 'src:tvmaze:7'],
    });
    const [interpretation] = curateReference(
      show,
      [wikidata('Q1'), makeSource('src:tvmaze:7', 'TVmaze')],
      NOW,
    ).interpretations;
    expect(interpretation.summary).toBe('“Break Point” is a 2023 TV programme (Wikidata, TVmaze).');
    expect(interpretation.sourceIds).toEqual(['src:wd:Q1', 'src:tvmaze:7']);
  });

  it('quoted in: the quoted line and the page it is on, from Wikiquote only', () => {
    const quote = retrieved('enwikiquote:42', 'Quoted in Thor: Ragnarok', {
      kind: 'quote',
      category: 'catchphrase',
      sourceIds: ['src:enwikiquote:42'],
    });
    const page = makeSource('src:enwikiquote:42', 'Wikiquote', {
      title: 'Thor: Ragnarok',
      excerpt: 'Point Break!',
    });
    const [interpretation] = curateReference(quote, [page], NOW).interpretations;
    expect(interpretation).toMatchObject({
      relation: 'quoted_in',
      label: 'On the Thor: Ragnarok page',
      summary: 'Matching text on the “Thor: Ragnarok” page: “Point Break!” (Wikiquote).',
      sourceIds: ['src:enwikiquote:42'],
      provenance: 'source_supported',
    });
  });

  it.each([
    ['wd:Q430178', 'Doctor Doom', 'character', '“Doctor Doom” is a comics character (Wikidata).'],
    ['wd:Q128444', 'Watchmen', 'work', '“Watchmen” is a comics work (Wikidata).'],
  ] as const)('comics: %s gets a comics noun', (id, title, kind, summary) => {
    const reference = retrieved(id, title, { kind, category: 'comics', sourceIds: [`src:${id}`] });
    const [interpretation] = curateReference(
      reference,
      [wikidata(id.slice(3))],
      NOW,
    ).interpretations;
    expect(interpretation).toMatchObject({ summary, provenance: 'source_supported' });
  });

  it('adds creators and first appearance, each credited to Wikidata', () => {
    const doom = retrieved('wd:Q430178', 'Doctor Doom', {
      kind: 'character',
      category: 'comics',
      sourceIds: ['src:wd:Q430178'],
      creators: ['Jack Kirby', 'Stan Lee'],
      firstAppearance: 'Fantastic Four #5',
    });
    const [interpretation] = curateReference(doom, [wikidata('Q430178')], NOW).interpretations;
    expect(interpretation.summary).toBe(
      '“Doctor Doom” is a comics character (Wikidata). Created by Jack Kirby and Stan Lee (Wikidata). ' +
        'First appeared in “Fantastic Four #5” (Wikidata).',
    );
    expect(interpretation).toMatchObject({ provenance: 'source_supported', spoiler: 'none' });
  });

  describe('appears in (Wikidata P1441)', () => {
    const redPill = (extra = {}) =>
      retrieved('wd:Q99', 'Red pill and blue pill', {
        kind: 'meme',
        category: 'meme',
        sourceIds: ['src:wd:Q99'],
        presentIn: [{ qid: 'Q83495', label: 'The Matrix' }],
        ...extra,
      });

    it('states where it appears, citing Wikidata', () => {
      const [interpretation] = curateReference(redPill(), [wikidata('Q99')], NOW).interpretations;
      expect(interpretation.summary).toContain('Appears in “The Matrix” (Wikidata).');
      expect(interpretation.sourceIds).toEqual(['src:wd:Q99']);
      expect(interpretation).toMatchObject({ provenance: 'source_supported' });
    });

    it('lists several works', () => {
      const reference = redPill({
        presentIn: [
          { qid: 'Q1', label: 'The Matrix' },
          { qid: 'Q2', label: 'The Matrix Reloaded' },
        ],
      });
      const [interpretation] = curateReference(reference, [wikidata('Q99')], NOW).interpretations;
      expect(interpretation.summary).toContain(
        'Appears in “The Matrix” and “The Matrix Reloaded” (Wikidata).',
      );
    });

    it('names a work once when different works share the name', () => {
      const reference = redPill({
        presentIn: [
          { qid: 'Q1', label: 'Fantastic Four' },
          { qid: 'Q2', label: 'Fantastic Four' },
          { qid: 'Q3', label: 'Fantastic Four' },
        ],
      });
      const [interpretation] = curateReference(reference, [wikidata('Q99')], NOW).interpretations;
      expect(interpretation.summary).toContain('Appears in “Fantastic Four” (Wikidata).');
    });

    it('links the interpretation only to a work that is already a reference', () => {
      const [alone] = curateReference(redPill(), [wikidata('Q99')], NOW).interpretations;
      expect(alone.relatedReferenceId).toBeUndefined();
      const known = new Set(['wd:Q83495']);
      const [linked] = curateReference(redPill(), [wikidata('Q99')], NOW, known).interpretations;
      expect(linked.relatedReferenceId).toBe('wd:Q83495');
      // A known ID that is not one of the works it appears in is never linked.
      const [other] = curateReference(
        redPill(),
        [wikidata('Q99')],
        NOW,
        new Set(['wd:Q1']),
      ).interpretations;
      expect(other.relatedReferenceId).toBeUndefined();
    });

    it('states what it was inspired by when Wikidata says so, and links a known work', () => {
      const reference = redPill({
        presentIn: undefined,
        inspiredBy: [{ qid: 'Q83495', label: 'The Matrix' }],
      });
      const [plain] = curateReference(reference, [wikidata('Q99')], NOW).interpretations;
      expect(plain.summary).toContain('Inspired by “The Matrix” (Wikidata).');
      expect(plain.summary).not.toContain('Appears in');
      expect(plain.relatedReferenceId).toBeUndefined();
      const [linked] = curateReference(
        reference,
        [wikidata('Q99')],
        NOW,
        new Set(['wd:Q83495']),
      ).interpretations;
      expect(linked.relatedReferenceId).toBe('wd:Q83495');
    });

    it('says nothing when Wikidata gave no work', () => {
      const [interpretation] = curateReference(
        redPill({ presentIn: undefined }),
        [wikidata('Q99')],
        NOW,
      ).interpretations;
      expect(interpretation.summary).not.toContain('Appears in');
    });
  });

  it('video games: a game character gets its own noun', () => {
    const mario = retrieved('wd:Q12379', 'Mario', {
      kind: 'character',
      category: 'games',
      sourceIds: ['src:wd:Q12379'],
    });
    expect(curateReference(mario, [wikidata('Q12379')], NOW).interpretations[0].summary).toBe(
      '“Mario” is a video game character (Wikidata).',
    );
  });

  it('dictionary: the Wiktionary sense, quoted without adding to it', () => {
    const entry = retrieved('enwiktionary:point break', 'point break', {
      kind: 'phrase',
      category: 'saying',
      sourceIds: ['src:enwiktionary:point break'],
    });
    const sense = makeSource('src:enwiktionary:point break', 'Wiktionary', {
      excerpt: 'A place where waves break over a point of land.',
    });
    const [interpretation] = curateReference(entry, [sense], NOW).interpretations;
    expect(interpretation).toMatchObject({
      relation: 'dictionary',
      label: 'Dictionary meaning',
      summary: 'Dictionary meaning: A place where waves break over a point of land (Wiktionary).',
      provenance: 'source_supported',
    });
  });

  it('related: what Wikidata says a non-work page is', () => {
    const meme = retrieved('wd:Q2', 'OK boomer', {
      kind: 'meme',
      category: 'meme',
      sourceIds: ['src:wd:Q2'],
    });
    const [interpretation] = curateReference(meme, [wikidata('Q2')], NOW).interpretations;
    expect(interpretation).toMatchObject({
      relation: 'related',
      label: 'Related page',
      summary: '“OK boomer” is an internet meme (Wikidata).',
    });
  });

  it('templates nothing for a page no source types, leaving it unexplained', () => {
    const topic = retrieved('enwiki:5', 'Some person', { sourceIds: ['src:enwiki:5'] });
    const result = curateReference(
      topic,
      [makeSource('src:enwiki:5', 'Wikipedia', { excerpt: 'A person.' })],
      NOW,
    );
    expect(result).toEqual({ interpretations: [], editorialState: 'retrieved' });
  });

  it('templates nothing for a quote or dictionary source without its text', () => {
    const quote = retrieved('enwikiquote:1', 'Quoted in X', {
      kind: 'quote',
      sourceIds: ['src:enwikiquote:1'],
    });
    expect(draftFor(quote, [makeSource('src:enwikiquote:1', 'Wikiquote')])).toBeUndefined();
  });

  it('is deterministic: the same evidence gives the same interpretations', () => {
    expect(curateReference(matrix, matrixSources, NOW)).toEqual(
      curateReference(matrix, matrixSources, NOW),
    );
  });
});

describe('claim ↔ source mapping', () => {
  it('cites exactly the sources behind each claim, and never the Wikipedia text it does not use', () => {
    const draft = draftFor(matrix, matrixSources);
    expect(draft?.claims).toEqual([
      { text: '“The Matrix” is a 1999 film', sourceIds: ['src:wd:Q83495'] },
    ]);
  });

  it('marks the interpretation unverified when a cited source is missing', () => {
    const withoutWikidata = matrixSources.filter((s) => s.publisher !== 'Wikidata');
    const result = curateReference(matrix, withoutWikidata, NOW);
    expect(result.interpretations[0]).toMatchObject({
      provenance: 'unverified',
      evidence: 'unverified',
      // The text never asserts an unbacked claim on its own.
      // Wikidata gave the year too, so the year goes with it.
      summary: 'Not verified: “The Matrix” is a film.',
    });
    expect(result.editorialState).toBe('retrieved');
  });

  it('drops a year whose own source is missing and keeps the type claim verified', () => {
    const tvYear = { ...matrix, yearSourceId: 'src:tvmaze:1' };
    const [interpretation] = curateReference(tvYear, matrixSources, NOW).interpretations;
    expect(interpretation).toMatchObject({
      provenance: 'source_supported',
      summary: '“The Matrix” is a film (Wikidata).',
      sourceIds: ['src:wd:Q83495'],
    });
  });

  it('never supports a claim that cites nothing', () => {
    expect(isClaimSupported({ text: 'x', sourceIds: [] }, matrixSources)).toBe(false);
  });
});

describe('cache eligibility (spec §4)', () => {
  const valid = new Set(matrixSources.map((s) => s.id));

  it('a source-supported curated interpretation may resolve a lookup offline', () => {
    const [interpretation] = curateReference(matrix, matrixSources, NOW).interpretations;
    expect(isCacheEligible(interpretation, valid)).toBe(true);
  });

  it('an unverified one never does', () => {
    const withoutWikidata = matrixSources.filter((s) => s.publisher !== 'Wikidata');
    const [interpretation] = curateReference(matrix, withoutWikidata, NOW).interpretations;
    expect(isCacheEligible(interpretation, valid)).toBe(false);
  });

  it('a supported one stops qualifying when its source is gone', () => {
    const [interpretation] = curateReference(matrix, matrixSources, NOW).interpretations;
    expect(isCacheEligible(interpretation, new Set(['src:enwiki:30007']))).toBe(false);
  });
});

describe('no invented facts', () => {
  it('states no year when the year has no source', () => {
    const unsourcedYear = { ...matrix, yearSourceId: undefined };
    const [interpretation] = curateReference(unsourcedYear, matrixSources, NOW).interpretations;
    expect(interpretation.summary).toBe('“The Matrix” is a film (Wikidata).');
    expect(interpretation.summary).not.toMatch(/\d/);
  });

  it('states no year when there is none', () => {
    const undated = { ...matrix, year: undefined, yearSourceId: undefined };
    expect(curateReference(undated, matrixSources, NOW).interpretations[0].summary).not.toMatch(
      /\d/,
    );
  });

  it('never links one reference to another, and never claims one references another', () => {
    const results = [matrix].map((r) => curateReference(r, matrixSources, NOW));
    for (const interpretation of results.flatMap((r) => r.interpretations)) {
      expect(interpretation.relatedReferenceId).toBeUndefined();
      expect(interpretation.summary).not.toMatch(/referenc|parod|inspired|origin/i);
    }
  });

  it('drops only Wikipedia-style disambiguators from titles, never part of the title', () => {
    const song = retrieved('wd:Q3', 'Another Brick in the Wall (Part 2)', {
      kind: 'work',
      category: 'music',
      sourceIds: ['src:wd:Q3'],
    });
    expect(curateReference(song, [wikidata('Q3')], NOW).interpretations[0].summary).toBe(
      '“Another Brick in the Wall (Part 2)” is a musical work (Wikidata).',
    );
  });

  it('never types a page that has no Wikidata record', () => {
    const film = retrieved('enwiki:9', 'A film', {
      kind: 'work',
      category: 'film',
      sourceIds: ['src:enwiki:9'],
    });
    expect(draftFor(film, [makeSource('src:enwiki:9', 'Wikipedia')])).toBeUndefined();
  });
});

describe('layered meanings ("point break")', () => {
  const film1991 = retrieved('wd:Q1', 'Point Break', {
    kind: 'work',
    category: 'film',
    year: 1991,
    yearSourceId: 'src:wd:Q1',
    sourceIds: ['src:wd:Q1'],
  });
  const film2015 = retrieved('wd:Q2', 'Point Break (2015 film)', {
    kind: 'work',
    category: 'film',
    year: 2015,
    yearSourceId: 'src:wd:Q2',
    sourceIds: ['src:wd:Q2'],
  });
  const quote = retrieved('enwikiquote:3', 'Quoted in Thor: Ragnarok', {
    kind: 'quote',
    category: 'catchphrase',
    sourceIds: ['src:enwikiquote:3'],
  });
  const sense = retrieved('enwiktionary:point break', 'point break', {
    kind: 'phrase',
    category: 'saying',
    sourceIds: ['src:enwiktionary:point break'],
  });
  const sources = [
    wikidata('Q1'),
    wikidata('Q2'),
    makeSource('src:enwikiquote:3', 'Wikiquote', {
      title: 'Thor: Ragnarok',
      excerpt: 'Point Break!',
    }),
    makeSource('src:enwiktionary:point break', 'Wiktionary', {
      excerpt: 'A surf break off a headland.',
    }),
  ];
  const all = [film1991, film2015, quote, sense];
  const curate = (r: Reference) =>
    curateReference(
      r,
      sources.filter((s) => r.sourceIds.includes(s.id)),
      NOW,
    ).interpretations[0];

  it('keeps each layer as its own source-backed interpretation, never merged or linked', () => {
    expect(all.map(curate).map((i) => [i.relation, i.summary])).toEqual([
      ['original', '“Point Break” is a 1991 film (Wikidata).'],
      ['original', '“Point Break” is a 2015 film (Wikidata).'],
      ['quoted_in', 'Matching text on the “Thor: Ragnarok” page: “Point Break!” (Wikiquote).'],
      ['dictionary', 'Dictionary meaning: A surf break off a headland (Wiktionary).'],
    ]);
    expect(all.map(curate).every((i) => i.relatedReferenceId === undefined)).toBe(true);
  });

  it('shows the films and the dictionary sense side by side; the quote page names no phrase to match', () => {
    const { otherMeanings } = relatedReferences(film1991, all, []);
    expect(otherMeanings.map((r) => r.id).sort()).toEqual(['enwiktionary:point break', 'wd:Q2']);
  });
});

describe('indefiniteArticle', () => {
  it.each([
    ['1999 film', 'a'],
    ['1897 film', 'an'],
    ['2011 film', 'a'],
    ['1800 film', 'an'],
    ['1100 saga', 'an'],
    ['8 film', 'an'],
    ['internet meme', 'an'],
    ['film', 'a'],
  ] as const)('%s → %s', (phrase, article) => {
    expect(indefiniteArticle(phrase)).toBe(article);
  });
});
