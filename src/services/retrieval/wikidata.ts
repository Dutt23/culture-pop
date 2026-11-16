import { QUERIED_CLASSES } from './classify';
import { EXTERNAL_ID_PROPERTIES } from './externalLinks';
import type { GetJson } from './types';
import { isRecord } from './validate';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const QID = /^Q\d+$/;
const ENTITY_PREFIX = 'http://www.wikidata.org/entity/';
const DIRECT_PROPERTY_PREFIX = 'http://www.wikidata.org/prop/direct/';
/** TVmaze series ID: lets a TVmaze result merge into the Wikidata item it describes. */
export const TVMAZE_ID_PROPERTY = 'P8600';
const ID_PROPERTIES = new Set([
  ...EXTERNAL_ID_PROPERTIES.map((p) => p.property),
  TVMAZE_ID_PROPERTY,
]);
const MAX_ID_CHARS = 300;
const YEAR = /^(\d{4})-/;
// Labels are untrusted text shown in a sentence: short, single-line, a handful per item.
const MAX_LABEL_CHARS = 120;
// Bounds memory only; the shown list is sorted and trimmed later, so row order never matters.
const MAX_CREATORS_READ = 20;
const MAX_PRESENT_IN_READ = 20;
/** "Present in work": the work an item (a meme, a phrase, a character) appears in. */
export const PRESENT_IN_PROPERTY = 'P1441';
/** "Inspired by": fills the gap P1441 leaves for memes and phrases (the red pill is inspired by The Matrix). */
export const INSPIRED_BY_PROPERTY = 'P941';
const CONTROL = /\p{Cc}/u;

export interface WikidataFacts {
  classes: Set<string>;
  /** Earliest publication (P577) or start (P580) year. */
  year?: number;
  /** Raw external IDs by property, unvalidated; see externalLinks.ts. */
  externalIds: Map<string, Set<string>>;
  /** English labels of its creators (P170), e.g. comics characters' writers and artists. */
  creators: Set<string>;
  /** English label of its first appearance (P4584), e.g. "Fantastic Four #5". */
  firstAppearance?: string;
  /** Works it appears in (P1441): item to English label, e.g. Q83495 to "The Matrix". */
  presentIn: Map<string, string>;
  /** Works it was inspired by (P941): item to English label. */
  inspiredBy: Map<string, string>;
}

/** Builds the SPARQL query. Only validated QIDs are interpolated, so input can't alter it. */
export function wikidataFactsUrl(qids: readonly string[]): string {
  const items = qids
    .filter((q) => QID.test(q))
    .map((q) => `wd:${q}`)
    .join(' ');
  const classes = QUERIED_CLASSES.map((q) => `wd:${q}`).join(' ');
  const idProperties = [...ID_PROPERTIES].map((p) => `wdt:${p}`).join(' ');
  // UNION, not separate OPTIONALs: rows add up per fact instead of multiplying across them.
  const query = [
    'SELECT ?item ?class ?date ?idProperty ?externalId ?creatorLabel ?firstAppearanceLabel ?presentIn ?presentInLabel ?inspiredBy ?inspiredByLabel WHERE {',
    `  VALUES ?item { ${items} }`,
    '  OPTIONAL {',
    `    { VALUES ?class { ${classes} } ?item wdt:P31/wdt:P279* ?class }`,
    '    UNION { ?item wdt:P577|wdt:P580 ?date }',
    `    UNION { VALUES ?idProperty { ${idProperties} } ?item ?idProperty ?externalId }`,
    '    UNION { ?item wdt:P170 ?creator }',
    '    UNION { ?item wdt:P4584 ?firstAppearance }',
    `    UNION { ?item wdt:${PRESENT_IN_PROPERTY} ?presentIn }`,
    `    UNION { ?item wdt:${INSPIRED_BY_PROPERTY} ?inspiredBy }`,
    '  }',
    // Explicit labels only: a missing English label stays unbound instead of becoming a QID.
    // "mul" (multilingual) labels: an item whose title is the same in every language, such as a film,
    // may have no "en" label of its own, and the service would then answer with its Q-number.
    '  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" .',
    '    ?creator rdfs:label ?creatorLabel . ?firstAppearance rdfs:label ?firstAppearanceLabel .',
    '    ?presentIn rdfs:label ?presentInLabel . ?inspiredBy rdfs:label ?inspiredByLabel . }',
    '}',
  ].join('\n');
  return `${ENDPOINT}?${new URLSearchParams({ query, format: 'json' })}`;
}

function entityId(binding: Record<string, unknown>, key: string): string | undefined {
  const cell = binding[key];
  if (!isRecord(cell) || typeof cell.value !== 'string') return undefined;
  const id = cell.value.startsWith(ENTITY_PREFIX) ? cell.value.slice(ENTITY_PREFIX.length) : '';
  return QID.test(id) ? id : undefined;
}

function label(binding: Record<string, unknown>, key: string): string | undefined {
  const cell = binding[key];
  if (!isRecord(cell) || typeof cell.value !== 'string') return undefined;
  const text = cell.value.trim();
  // A bare Q-number is the label service giving up, not a label.
  return text && text.length <= MAX_LABEL_CHARS && !CONTROL.test(text) && !QID.test(text)
    ? text
    : undefined;
}

function addExternalId(entry: WikidataFacts, binding: Record<string, unknown>): void {
  const property = isRecord(binding.idProperty) ? binding.idProperty.value : undefined;
  const id = isRecord(binding.externalId) ? binding.externalId.value : undefined;
  if (typeof property !== 'string' || typeof id !== 'string' || id.length > MAX_ID_CHARS) return;
  const pid = property.startsWith(DIRECT_PROPERTY_PREFIX)
    ? property.slice(DIRECT_PROPERTY_PREFIX.length)
    : '';
  if (!ID_PROPERTIES.has(pid)) return;
  const ids = entry.externalIds.get(pid) ?? new Set<string>();
  ids.add(id);
  entry.externalIds.set(pid, ids);
}

export function parseWikidataFacts(json: unknown): Map<string, WikidataFacts> {
  const facts = new Map<string, WikidataFacts>();
  if (!isRecord(json) || !isRecord(json.results) || !Array.isArray(json.results.bindings)) {
    return facts;
  }
  for (const binding of json.results.bindings) {
    if (!isRecord(binding)) continue;
    const item = entityId(binding, 'item');
    if (!item) continue;
    const entry: WikidataFacts = facts.get(item) ?? {
      classes: new Set(),
      externalIds: new Map(),
      creators: new Set(),
      presentIn: new Map(),
      inspiredBy: new Map(),
    };
    const cls = entityId(binding, 'class');
    if (cls) entry.classes.add(cls);
    const date = isRecord(binding.date) ? binding.date.value : undefined;
    const year = typeof date === 'string' ? YEAR.exec(date)?.[1] : undefined;
    if (year) entry.year = Math.min(entry.year ?? Infinity, Number(year));
    addExternalId(entry, binding);
    const creator = label(binding, 'creatorLabel');
    if (creator && entry.creators.size < MAX_CREATORS_READ) entry.creators.add(creator);
    // Only a work with an item and an English label is kept; the item is validated like any QID.
    const work = entityId(binding, 'presentIn');
    const workLabel = label(binding, 'presentInLabel');
    if (work && workLabel && entry.presentIn.size < MAX_PRESENT_IN_READ) {
      entry.presentIn.set(work, workLabel);
    }
    const inspiration = entityId(binding, 'inspiredBy');
    const inspirationLabel = label(binding, 'inspiredByLabel');
    if (inspiration && inspirationLabel && entry.inspiredBy.size < MAX_PRESENT_IN_READ) {
      entry.inspiredBy.set(inspiration, inspirationLabel);
    }
    // Several first-appearance statements are rare; the alphabetically first keeps it stable.
    const first = label(binding, 'firstAppearanceLabel');
    if (first && (entry.firstAppearance === undefined || first < entry.firstAppearance)) {
      entry.firstAppearance = first;
    }
    facts.set(item, entry);
  }
  return facts;
}

export async function fetchWikidataFacts(
  qids: readonly string[],
  getJson: GetJson,
  signal?: AbortSignal,
): Promise<Map<string, WikidataFacts>> {
  if (!qids.some((q) => QID.test(q))) return new Map();
  return parseWikidataFacts(await getJson(wikidataFactsUrl(qids), signal));
}

export function wikidataUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/${qid}`;
}
