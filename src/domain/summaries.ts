import { compareStrings } from './collections';
import type { Interpretation } from './types';

export interface CardSummary {
  meaningsCount: number;
  /** First spoiler-free summary, so cards never leak spoilers. */
  teaser?: string;
}

export function summarizeByReference(
  interpretations: readonly Interpretation[],
): Map<string, CardSummary> {
  const summaries = new Map<string, CardSummary>();
  const ordered = [...interpretations].sort((a, b) => compareStrings(a.id, b.id));
  for (const interpretation of ordered) {
    const current = summaries.get(interpretation.referenceId) ?? { meaningsCount: 0 };
    summaries.set(interpretation.referenceId, {
      meaningsCount: current.meaningsCount + 1,
      teaser:
        current.teaser ?? (interpretation.spoiler === 'none' ? interpretation.summary : undefined),
    });
  }
  return summaries;
}
