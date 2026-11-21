import { describe, expect, it } from 'vitest';
import { makeAlias, makeInterpretation, makeReference } from '../test/factories';
import { groupBy } from './collections';
import { isCacheEligible, needsRetrieval } from './eligibility';
import { rankReferences } from './ranking';
import type { Interpretation } from './types';

const VALID = new Set(['src-1', 'src-2']);

describe('isCacheEligible', () => {
  it.each<[string, Partial<Interpretation>, boolean]>([
    ['seed_curated is eligible', { provenance: 'seed_curated' }, true],
    [
      'source_supported with supported evidence and valid ids is eligible',
      { provenance: 'source_supported', evidence: 'supported', sourceIds: ['src-1', 'src-2'] },
      true,
    ],
    [
      'source_supported without source ids is not eligible',
      { provenance: 'source_supported', evidence: 'supported', sourceIds: [] },
      false,
    ],
    [
      'source_supported with an unknown source id is not eligible',
      { provenance: 'source_supported', evidence: 'supported', sourceIds: ['src-1', 'gone'] },
      false,
    ],
    [
      'source_supported with uncertain evidence is not eligible',
      { provenance: 'source_supported', evidence: 'uncertain', sourceIds: ['src-1'] },
      false,
    ],
    [
      'model_suggested is never eligible, even with "supported" evidence',
      { provenance: 'model_suggested', evidence: 'supported', sourceIds: ['src-1'] },
      false,
    ],
    ['unverified is not eligible', { provenance: 'unverified' }, false],
    [
      'user confirmation does not make an unverified interpretation eligible',
      { provenance: 'unverified', selection: 'user_confirmed' },
      false,
    ],
  ])('%s', (_name, overrides, expected) => {
    expect(isCacheEligible(makeInterpretation('i', 'r', overrides), VALID)).toBe(expected);
  });
});

describe('needsRetrieval', () => {
  const refs = [makeReference('top', 'Top'), makeReference('low', 'Top secret lower')];
  const aliases = [makeAlias('top', 'phrase')];

  function decide(interpretations: Interpretation[], query: string) {
    const matches = rankReferences(query, refs, aliases);
    return needsRetrieval(
      matches,
      groupBy(interpretations, (i) => i.referenceId),
      VALID,
    );
  }

  it('is still needed when only a typo or sound-alike match was found', () => {
    // "tpo" is one typo from "top" and the library has a seed-style eligible interpretation for it.
    const typoOnly = rankReferences('topp', refs, []).filter((m) => m.kind === 'typo');
    const fuzzy = [
      ...typoOnly,
      { reference: refs[0] as (typeof refs)[number], kind: 'sound' as const, matchedPhrase: 'Top' },
    ];
    const interpretations = [makeInterpretation('t1', 'top')];
    expect(fuzzy.length).toBeGreaterThan(0);
    expect(
      needsRetrieval(
        fuzzy,
        groupBy(interpretations, (i) => i.referenceId),
        VALID,
      ),
    ).toBe(true);
  });

  it('is still needed for a short search that only contains a known line', () => {
    const quote = [makeReference('quote', 'King of the world')];
    const matches = rankReferences('history of the titanic sinking', quote, [
      makeAlias('quote', 'titanic'),
    ]);
    expect(matches.map((m) => m.kind)).toEqual(['in_message']);
    const byReference = groupBy([makeInterpretation('q1', 'quote')], (i) => i.referenceId);
    expect(needsRetrieval(matches, byReference, VALID)).toBe(true);
    // In a pasted message the found line is the answer: the message never goes online.
    expect(needsRetrieval(matches, byReference, VALID, true)).toBe(false);
  });

  it('is still needed when the search ends partway through a word ("no cap" vs "No capes!")', () => {
    const capes = [makeReference('capes', 'No capes!')];
    const matches = rankReferences('no cap', capes, []);
    expect(matches.map((m) => m.kind)).toEqual(['title_prefix']);
    const byReference = groupBy([makeInterpretation('c1', 'capes')], (i) => i.referenceId);
    expect(needsRetrieval(matches, byReference, VALID)).toBe(true);
    // The whole word still settles it.
    expect(needsRetrieval(rankReferences('no capes', capes, []), byReference, VALID)).toBe(false);
    // Another alias that happens to contain the word "cap" doesn't vouch for the title match.
    const withAlias = rankReferences('no cap', capes, [makeAlias('capes', 'never a cap')]);
    expect(withAlias[0]).toMatchObject({ kind: 'title_prefix', partialWord: true });
    expect(needsRetrieval(withAlias, byReference, VALID)).toBe(true);
  });

  it('is needed when nothing matches', () => {
    expect(decide([], 'nothing here')).toBe(true);
  });

  it('is not needed when the top match has an eligible interpretation', () => {
    expect(decide([makeInterpretation('t1', 'top')], 'top')).toBe(false);
  });

  it('is not needed just because a lower-ranked match is ineligible', () => {
    const interpretations = [
      makeInterpretation('t1', 'top'),
      makeInterpretation('l1', 'low', { provenance: 'model_suggested' }),
    ];
    expect(decide(interpretations, 'top')).toBe(false);
  });

  it('is needed when the top match only has model-suggested candidates', () => {
    const interpretations = [
      makeInterpretation('t1', 'top', { provenance: 'model_suggested' }),
      makeInterpretation('l1', 'low'),
    ];
    expect(decide(interpretations, 'top')).toBe(true);
  });

  it('applies eligibility per interpretation, not per reference', () => {
    const interpretations = [
      makeInterpretation('t1', 'top', { provenance: 'unverified' }),
      makeInterpretation('t2', 'top', {
        provenance: 'source_supported',
        evidence: 'supported',
        sourceIds: ['src-1'],
      }),
    ];
    expect(decide(interpretations, 'phrase')).toBe(false);
  });
});
