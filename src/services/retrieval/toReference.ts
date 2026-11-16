import { normalizePhrase } from '../../domain/normalize';
import type { Reference } from '../../domain/types';
import type { RetrievedCandidate } from './types';

/** The shape a candidate takes once cached, shared by the cache and the UI so they never drift. */
export function candidateToReference(
  candidate: RetrievedCandidate,
  now: string,
  createdAt: string = now,
): Reference {
  return {
    id: candidate.id,
    title: candidate.title,
    normalizedTitle: normalizePhrase(candidate.title),
    category: candidate.category,
    kind: candidate.kind,
    year: candidate.year,
    yearSourceId: candidate.yearSourceId,
    creators: candidate.creators,
    firstAppearance: candidate.firstAppearance,
    presentIn: candidate.presentIn,
    inspiredBy: candidate.inspiredBy,
    sourceIds: candidate.sources.map((s) => s.id),
    externalLinks: candidate.externalLinks,
    tags: [],
    editorialState: 'retrieved',
    createdAt,
    updatedAt: now,
  };
}
