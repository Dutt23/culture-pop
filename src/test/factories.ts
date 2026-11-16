import { normalizePhrase } from '../domain/normalize';
import type { Alias, Interpretation, Reference, Source } from '../domain/types';
import type { RetrievedCandidate } from '../services/retrieval/types';

/** One fixed clock for every test, so dates in fixtures never depend on today. */
export const FIXED_NOW = '2026-11-15T12:00:00.000Z';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function makeReference(
  id: string,
  title: string,
  overrides: Partial<Reference> = {},
): Reference {
  return {
    id,
    title,
    normalizedTitle: normalizePhrase(title),
    category: 'film',
    kind: 'quote',
    sourceIds: [],
    tags: [],
    editorialState: 'demo',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function makeAlias(referenceId: string, phrase: string): Alias {
  const normalizedPhrase = normalizePhrase(phrase);
  return { id: `${referenceId}:${normalizedPhrase}`, phrase, normalizedPhrase, referenceId };
}

export function makeInterpretation(
  id: string,
  referenceId: string,
  overrides: Partial<Interpretation> = {},
): Interpretation {
  return {
    id,
    referenceId,
    label: 'Label',
    summary: 'Summary',
    context: 'Context',
    usageExample: 'Example',
    spoiler: 'none',
    sourceIds: [],
    provenance: 'seed_curated',
    evidence: 'unverified',
    selection: null,
    relation: 'original',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function makeSource(id: string, publisher: string, overrides: Partial<Source> = {}): Source {
  return {
    id,
    url: `https://example.org/${encodeURIComponent(id)}`,
    title: 'Title',
    publisher,
    sourceType: 'other',
    retrievedAt: FIXED_NOW,
    license: 'CC BY-SA 4.0',
    ...overrides,
  };
}

export function makeCandidate(
  fields: Partial<RetrievedCandidate> & Pick<RetrievedCandidate, 'id' | 'title'>,
): RetrievedCandidate {
  return {
    kind: 'other',
    category: 'other',
    classifying: false,
    role: 'topic',
    externalLinks: [],
    sources: [],
    ...fields,
  };
}
