import { stripDisambiguator } from '../../domain/normalize';
import { PUBLISHER, referenceId } from '../../domain/sources';
import { listOf } from '../../domain/text';
import type {
  Category,
  EditorialState,
  Interpretation,
  Reference,
  ReferenceKind,
  Relation,
  Source,
} from '../../domain/types';

/**
 * Deterministic curator (spec §5 Phase 3, §6 step 7). Fills fixed templates with facts the cached
 * sources state, and nothing else: no network, no model, no plot, no origin or date a source
 * doesn't give, no "this references X" link. Every claim names the source IDs that state it; an
 * interpretation is `source_supported` only when every claim's sources are present.
 */

/** One templated statement and the sources that state it. */
export interface Claim {
  text: string;
  sourceIds: string[];
}

export interface Draft {
  relation: Relation;
  label: string;
  claims: Claim[];
}

export interface CurationResult {
  interpretations: Interpretation[];
  /** `source_curated` once at least one interpretation is source-supported. */
  editorialState: Extract<EditorialState, 'retrieved' | 'source_curated'>;
}

const WIKTIONARY = PUBLISHER.wiktionary;
const WIKIQUOTE = PUBLISHER.wikiquote;

/**
 * Nouns for what Wikidata's class says a work is (by category) or a non-work is (by kind). Each
 * category can come from more than one class (classify.ts), so a noun never claims more than the
 * broadest of them: "TV programme" covers series and programmes, "phrase or slang term" both.
 */
const WORK_NOUN: Partial<Record<Category, string>> = {
  film: 'film',
  tv: 'TV programme',
  cartoon: 'animated film or series',
  // Wikidata's "comic" class spans series, graphic novels, strips and manga.
  comics: 'comics work',
  games: 'video game or series',
  music: 'musical work',
};
const KIND_NOUN: Partial<Record<ReferenceKind, string>> = {
  meme: 'internet meme',
  quote: 'catchphrase or quotation',
  character: 'fictional character',
  phrase: 'phrase or slang term',
};

const CHARACTER_NOUN: Partial<Record<Category, string>> = {
  comics: 'comics character',
  games: 'video game character',
};

const LABEL: Record<Exclude<Relation, 'quoted_in'>, string> = {
  // Neutral: Wikidata gives a type, never that this work is where the phrase started.
  original: 'The work',
  dictionary: 'Dictionary meaning',
  related: 'Related page',
};

/** "a"/"an" by sound for what templates produce: a noun, or a year then a noun ("an 1897 film"). */
export function indefiniteArticle(phrase: string): 'a' | 'an' {
  const [word = ''] = phrase.split(' ');
  if (/^\d/.test(word)) {
    // eight…, eleven / eleven hundred…, eighteen / eighteen hundred…
    return /^8/.test(word) || (/^1[18]/.test(word) && [2, 4].includes(word.length)) ? 'an' : 'a';
  }
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function sourceBy(sources: readonly Source[], publisher: string): Source | undefined {
  return sources.find((s) => s.publisher === publisher);
}

/** Wikidata is the only source of a type; its record ID follows from the reference's `wd:` ID. */
function wikidataSourceId(reference: Reference): string | undefined {
  return reference.id.startsWith('wd:') ? `src:${reference.id}` : undefined;
}

/** Relation as the cached sources state it. */
export function relationOf(reference: Reference, sources: readonly Source[]): Relation {
  if (sourceBy(sources, WIKIQUOTE)) return 'quoted_in';
  if (sourceBy(sources, WIKTIONARY)) return 'dictionary';
  return reference.kind === 'work' ? 'original' : 'related';
}

/** "“The Matrix” is a 1999 film", citing Wikidata for the type and the year's own source. */
function typeClaims(reference: Reference, sources: readonly Source[]): Claim[] {
  const noun =
    reference.kind === 'work'
      ? WORK_NOUN[reference.category]
      : reference.kind === 'character'
        ? (CHARACTER_NOUN[reference.category] ?? KIND_NOUN.character)
        : KIND_NOUN[reference.kind];
  const typeSource = wikidataSourceId(reference);
  if (!noun || !typeSource) return [];
  // A year is stated only together with the source that gives it (spec §4); never inferred.
  // A year whose source is gone is dropped, so it can't make the type claim unverified too.
  const yearSource =
    reference.year !== undefined && sources.some((s) => s.id === reference.yearSourceId)
      ? reference.yearSourceId
      : undefined;
  const descriptor = yearSource ? `${reference.year} ${noun}` : noun;
  return [
    {
      text: `“${stripDisambiguator(reference.title)}” is ${indefiniteArticle(descriptor)} ${descriptor}`,
      // Wikidata often gives both the type and the year: one source, cited once.
      sourceIds: [...new Set(yearSource ? [typeSource, yearSource] : [typeSource])],
    },
  ];
}

/** "Created by Jack Kirby and Stan Lee." "First appeared in “Fantastic Four #5”." "Appears in “The Matrix”." Wikidata only. */
function factClaims(reference: Reference): Claim[] {
  const source = wikidataSourceId(reference);
  if (!source) return [];
  return [
    ...(reference.creators?.length
      ? [{ text: `Created by ${listOf(reference.creators)}`, sourceIds: [source] }]
      : []),
    ...(reference.firstAppearance
      ? [{ text: `First appeared in “${reference.firstAppearance}”`, sourceIds: [source] }]
      : []),
    ...(reference.presentIn?.length
      ? [
          {
            text: `Appears in ${listOf(reference.presentIn.map((work) => `“${work.label}”`))}`,
            sourceIds: [source],
          },
        ]
      : []),
  ];
}

/** The template for this reference, or undefined when no sourced fact can fill one. */
export function draftFor(reference: Reference, sources: readonly Source[]): Draft | undefined {
  const relation = relationOf(reference, sources);
  if (relation === 'quoted_in') {
    const page = sourceBy(sources, WIKIQUOTE);
    if (!page?.excerpt) return undefined;
    return {
      relation,
      // A search snippet may come from any part of the page, so it's never called a quoted line.
      label: `On the ${page.title} page`,
      claims: [
        {
          text: `Matching text on the “${page.title}” page: “${page.excerpt}”`,
          sourceIds: [page.id],
        },
      ],
    };
  }
  if (relation === 'dictionary') {
    const entry = sourceBy(sources, WIKTIONARY);
    if (!entry?.excerpt) return undefined;
    return {
      relation,
      label: LABEL.dictionary,
      // The credit and full stop follow the sense, so its own closing full stop is dropped.
      claims: [
        {
          text: `Dictionary meaning: ${entry.excerpt.replace(/\.\s*$/, '')}`,
          sourceIds: [entry.id],
        },
      ],
    };
  }
  const claims = [...typeClaims(reference, sources), ...factClaims(reference)];
  return claims.length > 0 ? { relation, label: LABEL[relation], claims } : undefined;
}

/** A claim is supported only when it cites at least one source and every source it cites is present. */
export function isClaimSupported(claim: Claim, sources: readonly Source[]): boolean {
  const present = new Set(sources.map((s) => s.id));
  return claim.sourceIds.length > 0 && claim.sourceIds.every((id) => present.has(id));
}

/**
 * Each claim followed by the publishers it cites: "“The Matrix” is a 1999 film (Wikidata)." A claim
 * whose sources aren't all present is prefixed "Not verified:" so the text never asserts it alone.
 */
export function render(draft: Draft, sources: readonly Source[]): string {
  return draft.claims
    .map((claim) => {
      if (!isClaimSupported(claim, sources)) return `Not verified: ${claim.text}.`;
      const publishers = [
        ...new Set(
          claim.sourceIds.flatMap((id) => sources.find((s) => s.id === id)?.publisher ?? []),
        ),
      ];
      const credit = publishers.length > 0 ? ` (${publishers.join(', ')})` : '';
      return `${claim.text}${credit}.`;
    })
    .join(' ');
}

/**
 * `relatedReferenceId` only where a source states the link (D36): Wikidata says the reference
 * appears in a work, the interpretation says so, and that work is itself a cached or library
 * reference, so the link opens something. The first such work wins.
 */
function relatedLink(
  reference: Reference,
  draft: Draft,
  known: ReadonlySet<string>,
): { relatedReferenceId?: string } {
  if (!draft.claims.some((claim) => claim.text.startsWith('Appears in '))) return {};
  const work = reference.presentIn?.find((w) => known.has(referenceId.wikidata(w.qid)));
  return work ? { relatedReferenceId: referenceId.wikidata(work.qid) } : {};
}

/** Builds the reference's interpretations from its cached sources. Pure: same input, same output. */
export function curateReference(
  reference: Reference,
  sources: readonly Source[],
  now: string,
  /** IDs of references that are cached or in the library, so a stated link to one can be kept. */
  knownReferenceIds: ReadonlySet<string> = new Set(),
): CurationResult {
  const draft = draftFor(reference, sources);
  if (!draft) return { interpretations: [], editorialState: 'retrieved' };
  const supported = draft.claims.every((claim) => isClaimSupported(claim, sources));
  const interpretation: Interpretation = {
    id: `${reference.id}#${draft.relation}`,
    referenceId: reference.id,
    label: draft.label,
    summary: render(draft, sources),
    // Context and usage would need facts no source gives the curator; left empty, never invented.
    context: '',
    usageExample: '',
    // Matching text from a work's page can give the plot away ("I am your father"): hidden until a
    // spoiler check exists (owner decision, D37). Type, year and dictionary senses carry no plot.
    spoiler: draft.relation === 'quoted_in' ? 'major' : 'none',
    sourceIds: [...new Set(draft.claims.flatMap((c) => c.sourceIds))],
    provenance: supported ? 'source_supported' : 'unverified',
    evidence: supported ? 'supported' : 'unverified',
    selection: null,
    relation: draft.relation,
    ...relatedLink(reference, draft, knownReferenceIds),
    createdAt: now,
    updatedAt: now,
  };
  return {
    interpretations: [interpretation],
    editorialState: supported ? 'source_curated' : 'retrieved',
  };
}
