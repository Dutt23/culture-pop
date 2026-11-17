import { compareStrings, groupBy } from './collections';
import { normalizePhrase } from './normalize';
import { MATCH_RANK, rankReferences, type MatchKind } from './ranking';
import type { Alias, Interpretation, Pack, PackCeiling, PackMember, Reference } from './types';

export type PackSearchScope = { kind: 'pack'; packId: string } | { kind: 'all' };

export interface PackMatch {
  reference: Reference;
  kind: MatchKind;
  matchedPhrase: string;
}

export interface PackSearchHit {
  pack: Pack;
  /** Set when a member card matched. Absent when only the pack name matched. */
  member?: PackMatch;
}

/**
 * Everything pack search reads: the packs and their member rows. Never the unfiled library, the
 * online cache or the network.
 */
export interface PackIndex {
  packs: readonly Pack[];
  members: readonly PackMember[];
  /** The filed references. A reference without a member row never becomes a hit, even if passed. */
  references: readonly Reference[];
  aliases: readonly Alias[];
}

/** One pack's hits: its name matched, or some of its cards did, or both. */
export interface PackHitGroup {
  pack: Pack;
  nameMatched: boolean;
  cards: PackMatch[];
}

// Groups with no card match, or no name match, sort after every group that has one.
const NO_MATCH = Number.MAX_SAFE_INTEGER;

/** The pack list: the Now pack first, then the most recently changed. */
export function sortPacks(packs: readonly Pack[]): Pack[] {
  return [...packs].sort(
    (a, b) => Number(b.now) - Number(a.now) || compareStrings(b.updatedAt, a.updatedAt),
  );
}

/** Exact, then prefix, then substring on the pack's normalized name. */
function nameRank(pack: Pack, normalizedQuery: string): number {
  if (pack.normalizedName === normalizedQuery) return 0;
  if (pack.normalizedName.startsWith(normalizedQuery)) return 1;
  if (pack.normalizedName.includes(normalizedQuery)) return 2;
  return NO_MATCH;
}

/**
 * Searches the open pack or every pack. An empty query returns nothing: the pages list members by
 * position, or packs with `sortPacks`, instead. Fuzzy (typo, sound-alike) card matches sort under
 * the stricter ones and never lead anywhere online. No pagination: every hit is returned.
 */
export function searchPacks(
  query: string,
  scope: PackSearchScope,
  index: PackIndex,
): PackSearchHit[] {
  const normalized = normalizePhrase(query);
  if (!normalized) return [];
  const packs =
    scope.kind === 'pack' ? index.packs.filter((p) => p.id === scope.packId) : index.packs;
  // One ranking over every filed card; each pack then keeps only its own members.
  const ranked = new Map(
    rankReferences(query, index.references, index.aliases).map((m) => [m.reference.id, m]),
  );
  const membersByPack = groupBy(index.members, (m) => m.packId);

  const groups = packs.flatMap((pack) => {
    const name = nameRank(pack, normalized);
    const cards = (membersByPack.get(pack.id) ?? [])
      .flatMap((member) => {
        const match = ranked.get(member.referenceId);
        return match ? [{ position: member.position, match }] : [];
      })
      .sort(
        (a, b) => MATCH_RANK[a.match.kind] - MATCH_RANK[b.match.kind] || a.position - b.position,
      );
    if (name === NO_MATCH && cards.length === 0) return [];
    const best = cards.length > 0 ? MATCH_RANK[cards[0].match.kind] : NO_MATCH;
    return [{ pack, name, best, cards: cards.map((c) => c.match) }];
  });

  // Now only wins the sort: equal matches in other packs stay visible.
  groups.sort(
    (a, b) =>
      Number(b.pack.now) - Number(a.pack.now) ||
      a.best - b.best ||
      a.name - b.name ||
      compareStrings(a.pack.normalizedName, b.pack.normalizedName) ||
      compareStrings(a.pack.id, b.pack.id),
  );

  return groups.flatMap(({ pack, name, cards }) => [
    ...(name === NO_MATCH ? [] : [{ pack }]),
    ...cards.map(({ reference, kind, matchedPhrase }) => ({
      pack,
      member: { reference, kind, matchedPhrase },
    })),
  ]);
}

/** Folds `searchPacks` hits back into one group per pack, keeping their order. */
export function groupHits(hits: readonly PackSearchHit[]): PackHitGroup[] {
  return [...groupBy(hits, (hit) => hit.pack.id).values()].map((packHits) => ({
    pack: packHits[0].pack,
    nameMatched: packHits.some((hit) => !hit.member),
    cards: packHits.flatMap((hit) => (hit.member ? [hit.member] : [])),
  }));
}

export interface CeilingLines {
  /** The meaning whose glance lines lead the page, when any glance line was written. */
  glance?: Interpretation;
  /** Before you watch, with no glance line: a spoiler-free summary stands in. */
  safeSummary?: string;
  /** Before you watch, with neither: nothing spoiler-free has been filed for this card. */
  nothingSafe: boolean;
  /** Meanings that may be shown in full. */
  interpretations: Interpretation[];
}

/**
 * What a card opened from a pack may show. `before_watching` keeps the glance lines (hand-written,
 * spoiler-free by definition) and leaves out every major-spoiler meaning, summary and all. `open`
 * keeps everything; the reader's spoiler setting then applies as usual.
 */
export function linesForCeiling(
  interpretations: readonly Interpretation[],
  ceiling: PackCeiling,
): CeilingLines {
  const first = interpretations[0];
  const glance = first && (first.gist || first.socialMove || first.reply) ? first : undefined;
  if (ceiling === 'open') {
    return { glance, nothingSafe: false, interpretations: [...interpretations] };
  }
  const safe = interpretations.filter((i) => i.spoiler !== 'major');
  const safeSummary = glance ? undefined : safe.find((i) => i.summary)?.summary;
  return { glance, safeSummary, nothingSafe: !glance && !safeSummary, interpretations: safe };
}
