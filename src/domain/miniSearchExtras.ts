import { doubleMetaphone } from 'double-metaphone';
import MiniSearch, { type SearchResult } from 'minisearch';
import { compareReferences, groupBy } from './collections';
import { normalizePhrase, tokenize } from './normalize';
import type { RankedMatch } from './ranking';
import type { Alias, Reference } from './types';

/**
 * Typo-tolerant search for the references the deterministic tiers missed
 * (docs/SEARCH_RANKING.md, "MiniSearch trial"). Every query word must match a title or alias word,
 * allowing a prefix and about one typo per four letters. A second pass matches by sound (Double
 * Metaphone), which catches what edit distance cannot: swapped letters ("bzainga") count as two
 * edits but sound the same. Results are only ever *added* after the tiers, so an exact title or
 * alias match can never be outranked by a fuzzy or sound-alike one; sound-alike matches come after
 * the typo matches.
 */
const TITLE_BOOST = 2;
/**
 * Typos tolerated per query word: MiniSearch allows round(length x 0.25) edits, about one per four letters. A three-letter word may only have a
 * typo when other words in the query anchor the match (a lone "zzz" would otherwise find "izz");
 * shorter words never do.
 */
const MIN_FUZZY_WORD = 3;
const FUZZY_RATIO = 0.25;

interface Doc {
  id: string;
  title: string;
  aliases: string;
  /** Double Metaphone codes (primary and alternate) of every word in the title and aliases. */
  sound: string;
}

/** The distinct, non-empty Double Metaphone codes of one word. */
function soundCodes(word: string): string[] {
  return [...new Set(doubleMetaphone(word).filter((code) => code !== ''))];
}

const indexes = new WeakMap<readonly Reference[], { search: MiniSearch<Doc>; aliases: unknown }>();

function buildIndex(references: readonly Reference[], aliases: readonly Alias[]): MiniSearch<Doc> {
  const byReference = groupBy(aliases, (a) => a.referenceId);
  const search = new MiniSearch<Doc>({ fields: ['title', 'aliases', 'sound'] });
  search.addAll(
    references.map((r) => {
      const aliasText = (byReference.get(r.id) ?? []).map((a) => a.normalizedPhrase).join(' ');
      return {
        id: r.id,
        title: r.normalizedTitle,
        aliases: aliasText,
        sound: tokenize(`${r.normalizedTitle} ${aliasText}`.trim()).flatMap(soundCodes).join(' '),
      };
    }),
  );
  return search;
}

/** One index per library array, rebuilt when the array or its aliases change. */
function indexFor(references: readonly Reference[], aliases: readonly Alias[]): MiniSearch<Doc> {
  const cached = indexes.get(references);
  if (cached && cached.aliases === aliases) return cached.search;
  const search = buildIndex(references, aliases);
  indexes.set(references, { search, aliases });
  return search;
}

/** Query words this short are matched literally, or by sound only when other words anchor them. */
const SHORT_WORD = 3;

/** References not in `exclude` that match the query within the typo allowance, best first. */
export function fuzzyMatches(
  query: string,
  references: readonly Reference[],
  aliases: readonly Alias[],
  exclude: ReadonlySet<string>,
  /** Sound-alike pass on or off; off only so the benchmark can measure what it adds. */
  options: { sound?: boolean } = {},
): RankedMatch[] {
  const normalized = normalizePhrase(query);
  if (!normalized || references.length === 0) return [];
  const words = tokenize(normalized);
  const byId = new Map(references.map((r) => [r.id, r]));
  const index = indexFor(references, aliases);
  // A three-letter word may carry a typo only when other words anchor the match (a lone "zzz"
  // would otherwise find "izz"); shorter words never do.
  const typoHits = index.search(normalized, {
    prefix: true,
    combineWith: 'AND',
    fields: ['title', 'aliases'],
    boost: { title: TITLE_BOOST },
    fuzzy: (term, _index, terms) =>
      term.length < MIN_FUZZY_WORD || (term.length === MIN_FUZZY_WORD && terms.length < 2)
        ? false
        : FUZZY_RATIO,
  });
  // The same rule for sound: a lone short word ("ice" sounds like "is") is not matched by sound.
  const soundAllowed =
    options.sound !== false && !(words.length === 1 && (words[0] as string).length <= SHORT_WORD);
  const soundHits = soundAllowed
    ? index.search(
        {
          combineWith: 'AND',
          queries: words.map((word) => ({
            queries: soundCodes(word),
            combineWith: 'OR',
            fields: ['sound'],
          })),
        },
        { fields: ['sound'] },
      )
    : [];
  const ordered = (hits: readonly SearchResult[], skip: ReadonlySet<string>) =>
    hits
      .flatMap((hit) => {
        const reference = byId.get(hit.id);
        return reference && !exclude.has(reference.id) && !skip.has(reference.id)
          ? [{ reference, score: hit.score }]
          : [];
      })
      // Equal scores use the tiers' own tie-break (title, then ID), so order never depends on the index.
      .sort((a, b) => b.score - a.score || compareReferences(a.reference, b.reference))
      .map(({ reference }) => reference);
  const typo = ordered(typoHits, new Set());
  const typoIds = new Set(typo.map((r) => r.id));
  const sound = ordered(soundHits, typoIds);
  const as = (kind: 'typo' | 'sound') => (reference: Reference) => ({
    reference,
    kind,
    matchedPhrase: reference.title,
  });
  return [...typo.map(as('typo')), ...sound.map(as('sound'))];
}
