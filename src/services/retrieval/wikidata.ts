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

export interface WikidataFacts {
  classes: Set<string>;
  /** Earliest publication (P577) or start (P580) year. */
  year?: number;
  /** Raw external IDs by property, unvalidated; see externalLinks.ts. */
  externalIds: Map<string, Set<string>>;
}

/** Builds the SPARQL query. Only validated QIDs are interpolated, so input can't alter it. */
export function wikidataFactsUrl(qids: readonly string[]): string {
  const items = qids.filter((q) => QID.test(q)).map((q) => `wd:${q}`).join(' ');
  const classes = QUERIED_CLASSES.map((q) => `wd:${q}`).join(' ');
  const idProperties = [...ID_PROPERTIES].map((p) => `wdt:${p}`).join(' ');
  // UNION, not separate OPTIONALs: rows add up per fact instead of multiplying across them.
  const query = [
    'SELECT ?item ?class ?date ?idProperty ?externalId WHERE {',
    `  VALUES ?item { ${items} }`,
    '  OPTIONAL {',
    `    { VALUES ?class { ${classes} } ?item wdt:P31/wdt:P279* ?class }`,
    '    UNION { ?item wdt:P577|wdt:P580 ?date }',
    `    UNION { VALUES ?idProperty { ${idProperties} } ?item ?idProperty ?externalId }`,
    '  }',
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
    const entry: WikidataFacts = facts.get(item) ?? { classes: new Set(), externalIds: new Map() };
    const cls = entityId(binding, 'class');
    if (cls) entry.classes.add(cls);
    const date = isRecord(binding.date) ? binding.date.value : undefined;
    const year = typeof date === 'string' ? YEAR.exec(date)?.[1] : undefined;
    if (year) entry.year = Math.min(entry.year ?? Infinity, Number(year));
    addExternalId(entry, binding);
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
