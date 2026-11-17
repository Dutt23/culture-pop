import { describe, expect, it } from 'vitest';
import { makeAlias, makeInterpretation, makeReference } from '../test/factories';
import { normalizePhrase } from './normalize';
import { groupHits, linesForCeiling, searchPacks, sortPacks, type PackIndex } from './packs';
import type { Pack, PackMember, Reference } from './types';

function makePack(id: string, name: string, overrides: Partial<Pack> = {}): Pack {
  return {
    id,
    name,
    normalizedName: normalizePhrase(name),
    ceiling: 'before_watching',
    now: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function file(packId: string, referenceIds: readonly string[]): PackMember[] {
  return referenceIds.map((referenceId, position) => ({
    id: `pm:${packId}:${referenceId}`,
    packId,
    referenceId,
    position,
    addedAt: '2026-11-01T00:00:00.000Z',
  }));
}

const xavier = makeReference('xavier', 'Professor X', { kind: 'character' });
const magneto = makeReference('magneto', 'Magneto', { kind: 'character' });
const wolverine = makeReference('wolverine', 'Wolverine', { kind: 'character' });
const doom = makeReference('doom', 'Doctor Doom', { kind: 'character' });

const xMen = makePack('pack:x', 'Before X-Men');
const doomMovie = makePack('pack:doom', 'Before the Doom movie');

function indexOf(
  packs: readonly Pack[],
  members: readonly PackMember[],
  references: readonly Reference[] = [xavier, magneto, wolverine, doom],
): PackIndex {
  return { packs, members, references, aliases: [makeAlias('xavier', 'charles xavier')] };
}

const library = indexOf(
  [xMen, doomMovie],
  [...file(xMen.id, ['xavier', 'magneto', 'wolverine']), ...file(doomMovie.id, ['doom'])],
);

describe('searchPacks', () => {
  it('finds a card inside the open pack', () => {
    const hits = searchPacks('magneto', { kind: 'pack', packId: xMen.id }, library);
    expect(hits).toEqual([
      { pack: xMen, member: { reference: magneto, kind: 'exact_title', matchedPhrase: 'Magneto' } },
    ]);
  });

  it('never returns a card from another pack when searching inside one', () => {
    expect(searchPacks('doom', { kind: 'pack', packId: xMen.id }, library)).toEqual([]);
  });

  it('returns the pack on a name match even when no card matches', () => {
    expect(searchPacks('x-men', { kind: 'all' }, library)).toEqual([{ pack: xMen }]);
    expect(searchPacks('x men', { kind: 'pack', packId: xMen.id }, library)).toEqual([
      { pack: xMen },
    ]);
  });

  it('keeps every pack with a match across all packs, the Now pack first', () => {
    const now = { ...doomMovie, now: true };
    const index = indexOf(
      [xMen, now],
      [...file(xMen.id, ['xavier', 'doom']), ...file(now.id, ['doom'])],
    );
    const groups = groupHits(searchPacks('doctor doom', { kind: 'all' }, index));
    // The same card in two packs stays visible in both; Now only wins the order.
    expect(groups.map((g) => [g.pack.id, g.cards.map((c) => c.reference.id)])).toEqual([
      [now.id, ['doom']],
      [xMen.id, ['doom']],
    ]);
  });

  it('orders card hits by match tier, then by their place in the pack', () => {
    const lowerFirst = makeReference('lower', 'Magneto helmet');
    const index = indexOf([xMen], file(xMen.id, ['lower', 'magneto']), [lowerFirst, magneto]);
    const ids = searchPacks('magneto', { kind: 'pack', packId: xMen.id }, index).map(
      (hit) => hit.member?.reference.id,
    );
    expect(ids).toEqual(['magneto', 'lower']);
  });

  it('matches a card by its alias', () => {
    const [hit] = searchPacks('charles xavier', { kind: 'all' }, library);
    expect(hit.member).toMatchObject({ reference: xavier, kind: 'exact_alias' });
  });

  it('leaves out a cached online result that was never filed', () => {
    const cached = makeReference('wd:Q1', 'Magneto (film)', { editorialState: 'retrieved' });
    const index = indexOf([xMen], file(xMen.id, ['magneto']), [magneto, cached]);
    const ids = searchPacks('magneto', { kind: 'all' }, index).map((h) => h.member?.reference.id);
    expect(ids).toEqual(['magneto']);
  });

  it('leaves out a library card with no member row', () => {
    // Favourites never reach the index; the page test checks a real favourite stays out.
    const index = indexOf([xMen], file(xMen.id, ['xavier']));
    expect(searchPacks('wolverine', { kind: 'all' }, index)).toEqual([]);
  });

  it('returns nothing for an empty query', () => {
    expect(searchPacks('  ', { kind: 'all' }, library)).toEqual([]);
  });

  it('lists packs Now first, then the most recently changed', () => {
    const older = makePack('a', 'Older', { updatedAt: '2026-11-01T00:00:00.000Z' });
    const newer = makePack('b', 'Newer', { updatedAt: '2026-11-10T00:00:00.000Z' });
    const now = makePack('c', 'Now', { now: true, updatedAt: '2026-10-01T00:00:00.000Z' });
    expect(sortPacks([older, newer, now]).map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('linesForCeiling', () => {
  const safe = makeInterpretation('snap.1', 'snap', {
    gist: 'Make something vanish instantly.',
    summary: 'Thanos plans to wipe out half of all life.',
  });
  const ending = makeInterpretation('snap.2', 'snap', {
    gist: 'Disappearing into dust, as a joke.',
    summary: 'Half of all living things turn to dust.',
    spoiler: 'major',
  });

  it('before you watch: keeps the glance lines and drops a major summary', () => {
    const lines = linesForCeiling([safe, ending], 'before_watching');
    expect(lines.glance).toBe(safe);
    expect(lines.interpretations).toEqual([safe]);
    expect(lines.nothingSafe).toBe(false);
  });

  it('open: keeps the major meaning', () => {
    expect(linesForCeiling([safe, ending], 'open').interpretations).toEqual([safe, ending]);
  });

  it('shows a spoiler-free summary when no glance line was written', () => {
    const plain = { ...safe, gist: undefined };
    const lines = linesForCeiling([plain, ending], 'before_watching');
    expect(lines.glance).toBeUndefined();
    expect(lines.safeSummary).toBe('Thanos plans to wipe out half of all life.');
  });

  it('says nothing spoiler-free is filed when every meaning is a major spoiler', () => {
    const lines = linesForCeiling([{ ...ending, gist: undefined }], 'before_watching');
    expect(lines).toMatchObject({ nothingSafe: true, interpretations: [] });
  });
});
