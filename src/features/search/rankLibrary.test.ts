import { describe, expect, it } from 'vitest';
import type { SearchIndex } from '../../data/repositories/referenceRepository';
import { buildSeed } from '../../data/seed';
import { groupBy } from '../../domain/collections';
import { needsRetrieval } from '../../domain/eligibility';
import { isAmbiguous, looksLikeMessage, rankReferences } from '../../domain/ranking';
import { summarizeByReference } from '../../domain/summaries';
import {
  isFromOnline,
  type EditorialState,
  type Interpretation,
  type Reference,
  type Source,
} from '../../domain/types';
import { prepareLibrary, rankLibrary } from './rankLibrary';

const NOW = '2026-11-21T00:00:00.000Z';

function online(id: string, title: string, state: EditorialState, sourceIds: string[]): Reference {
  return {
    id,
    title,
    normalizedTitle: title.toLowerCase(),
    category: 'meme',
    kind: 'phrase',
    sourceIds,
    tags: [],
    editorialState: state,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function source(id: string, excerpt: string): Source {
  return {
    id,
    url: `https://example.org/${id}`,
    title: id,
    publisher: 'Example',
    sourceType: 'encyclopedia',
    retrievedAt: NOW,
    license: 'CC BY-SA 4.0',
    excerpt,
  };
}

function sourcedMeaning(referenceId: string, sourceId: string): Interpretation {
  return {
    id: `i:${referenceId}`,
    referenceId,
    label: 'Meaning',
    summary: 'What it means, from the source.',
    context: '',
    usageExample: '',
    spoiler: 'none',
    sourceIds: [sourceId],
    provenance: 'source_supported',
    evidence: 'supported',
    selection: null,
    relation: 'original',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function index(extra: { references?: Reference[]; interpretations?: Interpretation[] } = {}) {
  const seed = buildSeed();
  const sources = [source('src:zorblax', 'Zorblax is a word.'), source('src:blorp', 'Blorp.')];
  return {
    references: [...seed.references, ...(extra.references ?? [])],
    aliases: seed.aliases,
    interpretations: [...seed.interpretations, ...(extra.interpretations ?? [])],
    sources,
    validSourceIds: new Set(sources.map((s) => s.id)),
  } satisfies SearchIndex;
}

/** The logic `useSearch` ran inline before it moved off the main thread. */
function oldSearch(library: SearchIndex, query: string) {
  const curated = library.references.filter((r) => !isFromOnline(r.editorialState));
  const fromOnline = library.references.filter((r) => isFromOnline(r.editorialState));
  const matches = rankReferences(query, curated, library.aliases);
  const onlineMatches = rankReferences(query, fromOnline, library.aliases);
  const byReference = groupBy(library.interpretations, (i) => i.referenceId);
  const excerpts = new Map(library.sources.map((s) => [s.id, s.excerpt]));
  const savedOnline = onlineMatches.map(({ reference }) => ({
    reference,
    teaser: reference.sourceIds.map((id) => excerpts.get(id)).find(Boolean),
  }));
  const isMessage = looksLikeMessage(query);
  const resolves = !needsRetrieval(matches, byReference, library.validSourceIds, isMessage);
  return {
    matches,
    isAmbiguous: isAmbiguous(matches),
    needsRetrieval:
      !resolves && needsRetrieval(onlineMatches, byReference, library.validSourceIds, isMessage),
    summaries: summarizeByReference(library.interpretations),
    savedOnline: resolves ? [] : savedOnline,
  };
}

const withOnline = index({
  references: [
    online('ret:zorblax', 'Zorblax the unready', 'retrieved', ['src:zorblax']),
    online('cur:blorp', 'Blorp moment', 'source_curated', ['src:blorp']),
  ],
  interpretations: [sourcedMeaning('cur:blorp', 'src:blorp')],
});
const seedTitle = buildSeed().references[0].title;

describe('rankLibrary', () => {
  it.each<[string, SearchIndex, string]>([
    ['built-in library, a built-in title', index(), seedTitle],
    ['built-in library, an unknown word', index(), 'qwertyuiop'],
    ['with online results, a saved raw result', withOnline, 'zorblax'],
    ['with online results, a saved explained result', withOnline, 'blorp moment'],
    ['with online results, a built-in title', withOnline, seedTitle],
    ['with online results, a message', withOnline, `my friend said ${seedTitle} to me today`],
    ['with online results, an empty query', withOnline, ''],
  ])('answers like the old inline search: %s', (_name, library, query) => {
    const old = oldSearch(library, query);
    const result = rankLibrary(prepareLibrary(library), query);

    expect(result.matches).toEqual(old.matches);
    expect(result.isAmbiguous).toBe(old.isAmbiguous);
    expect(result.needsRetrieval).toBe(old.needsRetrieval);
    expect(result.savedOnline).toEqual(old.savedOnline);
    const shown = [...result.matches, ...result.savedOnline].map((m) => m.reference.id);
    for (const id of shown) expect(result.summaries.get(id)).toEqual(old.summaries.get(id));
  });

  it('summarises only the references it shows', () => {
    const result = rankLibrary(prepareLibrary(withOnline), 'zorblax');

    const shown = new Set([...result.matches, ...result.savedOnline].map((m) => m.reference.id));
    expect(result.savedOnline.map((m) => m.reference.id)).toContain('ret:zorblax');
    expect(result.savedOnline[0].teaser).toBe('Zorblax is a word.');
    expect([...result.summaries.keys()].every((id) => shown.has(id))).toBe(true);
    expect(result.summaries.size).toBeLessThan(withOnline.references.length);
  });
});
