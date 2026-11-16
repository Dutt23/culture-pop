import type { Interpretation, Reference, Source } from '../../domain/types';
import { relationOf } from '../curation/curate';
import { keptSentences, type ExplanationCheck, type Uncertainty } from './check';

/**
 * Turns a checked model explanation into an `Interpretation` (spec §5 Phase 3). Model text is
 * always `model_suggested`, never `source_supported`: only the curator's templates are that.
 */

export interface ModelExplanation {
  interpretation: Interpretation;
  /** The model's own caution, shown as such; never used as verification. */
  uncertainty: Uncertainty;
}

/** Undefined when no meaning survived the checks: the caller keeps the curator's text. */
export function toInterpretation(
  check: ExplanationCheck,
  reference: Reference,
  sources: readonly Source[],
  now: string,
): ModelExplanation | undefined {
  if (!check.valid || check.meaning.length === 0) return undefined;
  const kept = keptSentences(check);
  const present = new Set(sources.map((s) => s.id));
  const supported = kept.every(
    (s) => s.sourceIds.length > 0 && s.sourceIds.every((id) => present.has(id)),
  );
  return {
    interpretation: {
      id: `${reference.id}#model`,
      referenceId: reference.id,
      label: 'In plain words (AI)',
      summary: check.meaning.map((s) => s.text).join(' '),
      context: check.context.map((s) => s.text).join(' '),
      usageExample: check.example ? `“${check.example.text}”` : '',
      spoiler: check.spoiler,
      sourceIds: [...new Set(kept.flatMap((s) => s.sourceIds))],
      provenance: 'model_suggested',
      evidence: supported ? 'supported' : 'uncertain',
      selection: null,
      relation: relationOf(reference, sources),
      createdAt: now,
      updatedAt: now,
    },
    uncertainty: check.uncertainty,
  };
}
