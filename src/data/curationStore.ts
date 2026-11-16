import type { EntityTable } from 'dexie';
import { referenceId } from '../domain/sources';
import type { Interpretation, Reference, Source } from '../domain/types';
import { curateReference } from '../services/curation/curate';

export interface CurationTarget {
  reference: Reference;
  /** The sources the reference cites, as they are now. */
  sources: readonly Source[];
}

/**
 * (Re)curates references from their current sources and stores the result: their previous curator
 * output is replaced and each reference's editorial state follows the outcome. Call inside a
 * transaction covering both tables. Keeps `createdAt` and any personal `selection` across re-curation.
 */
export async function storeCuration(
  references: EntityTable<Reference, 'id'>,
  interpretations: EntityTable<Interpretation, 'id'>,
  targets: readonly CurationTarget[],
  now: string,
): Promise<void> {
  const previous = await interpretations
    .where('referenceId')
    .anyOf(targets.map((t) => t.reference.id))
    .toArray();
  const previousById = new Map(previous.map((i) => [i.id, i]));
  // A work a reference appears in can be linked only if it is already stored or saved in this batch.
  const workIds = [
    ...new Set(
      targets.flatMap((t) =>
        [...(t.reference.presentIn ?? []), ...(t.reference.inspiredBy ?? [])].map((w) =>
          referenceId.wikidata(w.qid),
        ),
      ),
    ),
  ];
  const stored = workIds.length > 0 ? await references.bulkGet(workIds) : [];
  const known = new Set([
    ...stored.flatMap((r) => (r ? [r.id] : [])),
    ...targets.map((t) => t.reference.id),
  ]);
  const curated = targets.map(({ reference, sources }) => ({
    reference,
    result: curateReference(reference, sources, now, known),
  }));

  await interpretations.bulkDelete(previous.map((i) => i.id));
  await interpretations.bulkPut(
    curated.flatMap(({ result }) =>
      result.interpretations.map((interpretation) => {
        const before = previousById.get(interpretation.id);
        return before
          ? { ...interpretation, createdAt: before.createdAt, selection: before.selection }
          : interpretation;
      }),
    ),
  );
  await references.bulkPut(
    curated.map(({ reference, result }) => ({
      ...reference,
      editorialState: result.editorialState,
    })),
  );
}
