import { normalizePhrase } from '../domain/normalize';
import type { Alias, Interpretation, Reference } from '../domain/types';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function makeReference(id: string, title: string, overrides: Partial<Reference> = {}): Reference {
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
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}
