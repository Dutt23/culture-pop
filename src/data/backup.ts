import { safeHref } from '../components/ui/safeHref';
import { CATEGORY_LABEL, CEILING_LABEL } from '../domain/labels';
import { SETTING_LABELS, type SettingKey } from '../domain/settings';
import { PUBLISHER } from '../domain/sources';
import { EXTERNAL_ID_PROPERTIES } from '../services/retrieval/externalLinks';
import type {
  Category,
  ExternalLink,
  Favourite,
  PackCeiling,
  PresentIn,
  ReferenceKind,
  SavedLink,
  Setting,
  Source,
  SourceType,
} from '../domain/types';

/** Written into every backup file so a file from anything else is refused. */
export const BACKUP_APP = 'pop-culture-decoder';
export const BACKUP_VERSION = 1;
/** A backup is a few hundred kilobytes at most; anything far bigger isn't one. */
export const MAX_BACKUP_BYTES = 5_000_000;

/**
 * Settings that stay on each device: the two consents to send search text are asked on each device,
 * after its own disclosure. (A sign-in never comes along: it is a cookie on this device only.)
 */
const DEVICE_ONLY_SETTINGS: ReadonlySet<string> = new Set<SettingKey>(['retrieval', 'webSearch']);
/** The free-form search-tags row beside the enumerated settings (docs/SEARCH_TAGS_PLAN.md). */
const SEARCH_TAGS_KEY = 'searchTags';
const MAX_SEARCH_TAGS_LENGTH = 20_000;

const MAX_ITEMS = 10_000;
const MAX_TEXT = 2_000;

const KINDS = {
  work: true,
  quote: true,
  phrase: true,
  meme: true,
  character: true,
  other: true,
} as const satisfies Record<ReferenceKind, true>;

/** IDs of cards found online (`referenceId` in src/domain/sources.ts); anything else is refused. */
const ONLINE_ID = /^(wd:Q\d+|enwiki:\d+|enwikiquote:\d+|enwiktionary:.+)$/;

/** Each publisher's own site: a restored source must point where that publisher's pages live. */
const PUBLISHER_HOST: Readonly<Record<string, string>> = {
  [PUBLISHER.wikipedia]: 'en.wikipedia.org',
  [PUBLISHER.wikidata]: 'www.wikidata.org',
  [PUBLISHER.wiktionary]: 'en.wiktionary.org',
  [PUBLISHER.wikiquote]: 'en.wikiquote.org',
  [PUBLISHER.tvmaze]: 'www.tvmaze.com',
};

/** "Label|host" of every outside page the app itself links to, so a file can't relabel a link. */
const LINK_SITES: ReadonlySet<string> = new Set(
  EXTERNAL_ID_PROPERTIES.map(({ label, template }) => `${label}|${new URL(template).hostname}`),
);

const SOURCE_TYPES = {
  encyclopedia: true,
  dictionary: true,
  structured_data: true,
  official: true,
  other: true,
} as const satisfies Record<SourceType, true>;

/** A card found online that a favourite or a pack points to, kept so it still opens elsewhere. */
export interface BackupReference {
  id: string;
  title: string;
  kind: ReferenceKind;
  category: Category;
  year?: number;
  yearSourceId?: string;
  creators?: string[];
  firstAppearance?: string;
  presentIn?: PresentIn[];
  inspiredBy?: PresentIn[];
  sources: Source[];
  externalLinks: ExternalLink[];
}

export interface BackupPackMember {
  referenceId: string;
  addedAt: string;
  doneAt?: string;
}

export interface BackupPack {
  id: string;
  name: string;
  ceiling: PackCeiling;
  now: boolean;
  createdAt: string;
  updatedAt: string;
  /** In pack order. */
  members: BackupPackMember[];
}

/**
 * Everything a backup holds: favourites, packs, saved web links, settings (search tags included)
 * and the online-found cards those point to. Never search history, kept wider-web results, the
 * online cache as a whole, or anything about signing in.
 */
export interface Backup {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  favourites: Favourite[];
  savedLinks: SavedLink[];
  settings: Setting[];
  packs: BackupPack[];
  references: BackupReference[];
}

export interface ParsedBackup {
  backup: Backup;
  /** Items that were malformed and left out; the rest is still usable. */
  skipped: number;
}

/** A file that can't be used at all. The message is shown to the reader as it is. */
export class BackupError extends Error {
  override name = 'BackupError';
}

const NOT_A_BACKUP = "This file isn't a Pop Culture Decoder backup.";

/** The first of each key: a store holds one row per key, so a repeat would fail the restore. */
function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(key(item)) && Boolean(seen.add(key(item))));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isText = (value: unknown, max = MAX_TEXT): value is string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= max;

/** An ISO date and time, stored in the one form the app sorts by; anything else is refused. */
function parseTime(value: unknown): string | undefined {
  if (!isText(value, 64) || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

const optionalText = (value: unknown): string | undefined => (isText(value) ? value : undefined);

/** The https form `safeHref` writes, so a restored link is exactly one the app would store. */
const isLink = (value: unknown): value is string =>
  typeof value === 'string' && safeHref(value) === value;

/** Settings the app can read back: a known value of a known setting, or the search-tags text. */
export function isPortableSetting(row: unknown): row is Setting {
  if (!isRecord(row) || typeof row.key !== 'string' || typeof row.value !== 'string') return false;
  if (row.key === SEARCH_TAGS_KEY) return row.value.length <= MAX_SEARCH_TAGS_LENGTH;
  if (DEVICE_ONLY_SETTINGS.has(row.key) || !Object.hasOwn(SETTING_LABELS, row.key)) return false;
  return Object.hasOwn(SETTING_LABELS[row.key as SettingKey], row.value);
}

function parseWorks(value: unknown): PresentIn[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((work) =>
    isRecord(work) && typeof work.qid === 'string' && /^Q\d+$/.test(work.qid) && isText(work.label)
      ? [{ qid: work.qid, label: work.label }]
      : [],
  );
}

function parseSource(value: unknown): Source | undefined {
  if (!isRecord(value)) return undefined;
  const { id, url, title, publisher, sourceType, retrievedAt, license } = value;
  if (!isText(id) || !isLink(url) || !isText(title) || typeof publisher !== 'string') {
    return undefined;
  }
  const host = Object.hasOwn(PUBLISHER_HOST, publisher) ? PUBLISHER_HOST[publisher] : undefined;
  if (new URL(url).hostname !== host) return undefined;
  if (typeof sourceType !== 'string' || !Object.hasOwn(SOURCE_TYPES, sourceType)) return undefined;
  const retrieved = parseTime(retrievedAt);
  if (!retrieved || !isText(license)) return undefined;
  const excerpt = optionalText(value.excerpt);
  return {
    id,
    url,
    title,
    publisher,
    sourceType: sourceType as SourceType,
    retrievedAt: retrieved,
    license,
    ...(excerpt ? { excerpt } : {}),
  };
}

function parseReference(value: unknown): BackupReference | undefined {
  if (!isRecord(value) || !isText(value.id, 300) || !ONLINE_ID.test(value.id)) return undefined;
  if (!isText(value.title)) return undefined;
  const { kind, category } = value;
  if (typeof kind !== 'string' || !Object.hasOwn(KINDS, kind)) return undefined;
  if (typeof category !== 'string' || !Object.hasOwn(CATEGORY_LABEL, category)) return undefined;
  if (!Array.isArray(value.sources)) return undefined;
  const sources = uniqueBy(
    value.sources.flatMap((s) => parseSource(s) ?? []),
    (s) => s.id,
  );
  const yearSourceId = typeof value.yearSourceId === 'string' ? value.yearSourceId : undefined;
  const year = yearSourceId && Number.isInteger(value.year) ? (value.year as number) : undefined;
  const externalLinks = Array.isArray(value.externalLinks)
    ? value.externalLinks.flatMap((link) =>
        isRecord(link) &&
        isText(link.label) &&
        isLink(link.url) &&
        LINK_SITES.has(`${link.label}|${new URL(link.url).hostname}`)
          ? [{ label: link.label, url: link.url }]
          : [],
      )
    : [];
  const creators = Array.isArray(value.creators)
    ? value.creators.filter((c): c is string => isText(c))
    : undefined;
  const firstAppearance = optionalText(value.firstAppearance);
  const presentIn = parseWorks(value.presentIn);
  const inspiredBy = parseWorks(value.inspiredBy);
  // A card found online is only ever evidence: with no source left it has nothing to show.
  return keepSources({
    id: value.id,
    title: value.title,
    kind: kind as ReferenceKind,
    category: category as Category,
    ...(year !== undefined ? { year, yearSourceId } : {}),
    ...(creators ? { creators } : {}),
    ...(firstAppearance ? { firstAppearance } : {}),
    ...(presentIn ? { presentIn } : {}),
    ...(inspiredBy ? { inspiredBy } : {}),
    sources,
    externalLinks,
  });
}

/**
 * The card with only the sources `keep` allows, or undefined when none is left. A year needs the
 * source that states it (spec §4), so it goes when that source does.
 */
export function keepSources(
  reference: BackupReference,
  keep: (source: Source) => boolean = () => true,
): BackupReference | undefined {
  const sources = reference.sources.filter(keep);
  if (sources.length === 0) return undefined;
  if (sources.some((s) => s.id === reference.yearSourceId)) return { ...reference, sources };
  return { ...reference, sources, year: undefined, yearSourceId: undefined };
}

function parsePack(value: unknown): BackupPack | undefined {
  if (!isRecord(value) || !isText(value.id, 300) || !value.id.startsWith('pack:')) return undefined;
  const { name, ceiling, now } = value;
  const [createdAt, updatedAt] = [parseTime(value.createdAt), parseTime(value.updatedAt)];
  if (!isText(name) || typeof now !== 'boolean') return undefined;
  if (typeof ceiling !== 'string' || !Object.hasOwn(CEILING_LABEL, ceiling)) return undefined;
  if (!createdAt || !updatedAt || !Array.isArray(value.members)) return undefined;
  const seen = new Set<string>();
  const members = value.members.flatMap((member): BackupPackMember[] => {
    const addedAt = isRecord(member) ? parseTime(member.addedAt) : undefined;
    if (!isRecord(member) || !isText(member.referenceId, 300) || !addedAt) return [];
    if (seen.has(member.referenceId)) return [];
    seen.add(member.referenceId);
    const doneAt = parseTime(member.doneAt);
    return [{ referenceId: member.referenceId, addedAt, ...(doneAt ? { doneAt } : {}) }];
  });
  return {
    id: value.id,
    name: name.trim(),
    ceiling: ceiling as PackCeiling,
    now,
    createdAt,
    updatedAt,
    members,
  };
}

function parseFavourite(value: unknown): Favourite | undefined {
  const savedAt = isRecord(value) ? parseTime(value.savedAt) : undefined;
  return isRecord(value) && isText(value.referenceId, 300) && savedAt
    ? { referenceId: value.referenceId, savedAt }
    : undefined;
}

function parseSavedLink(value: unknown): SavedLink | undefined {
  const savedAt = isRecord(value) ? parseTime(value.savedAt) : undefined;
  return isRecord(value) && isLink(value.url) && isText(value.title) && savedAt
    ? { url: value.url, title: value.title.trim(), savedAt }
    : undefined;
}

/**
 * A source ID and its address must agree across the whole file, as they do in the database (`url`
 * is unique there). A clashing source is dropped; a card left with no source goes with it.
 */
function withConsistentSources(references: readonly BackupReference[]): BackupReference[] {
  const urlById = new Map<string, string>();
  const idByUrl = new Map<string, string>();
  return references.flatMap(
    (reference) =>
      keepSources(reference, ({ id, url }) => {
        if ((urlById.get(id) ?? url) !== url || (idByUrl.get(url) ?? id) !== id) return false;
        urlById.set(id, url);
        idByUrl.set(url, id);
        return true;
      }) ?? [],
  );
}

/**
 * Reads a backup file's JSON. The file is untrusted: a file that isn't a backup at all throws a
 * `BackupError` with a plain message; a malformed item inside a real backup is left out and
 * counted.
 * Only the fields the app stores are copied, so nothing else in the file can reach the database.
 */
export function parseBackup(json: unknown): ParsedBackup {
  if (!isRecord(json) || json.app !== BACKUP_APP) throw new BackupError(NOT_A_BACKUP);
  if (Number.isInteger(json.version) && (json.version as number) > BACKUP_VERSION) {
    throw new BackupError(
      'This backup was made by a newer version of the app. Update the app, then try again.',
    );
  }
  if (json.version !== BACKUP_VERSION) throw new BackupError(NOT_A_BACKUP);
  let skipped = 0;
  const list = <T>(value: unknown, parse: (item: unknown) => T | undefined): T[] => {
    if (!Array.isArray(value)) throw new BackupError(NOT_A_BACKUP);
    if (value.length > MAX_ITEMS) throw new BackupError('This backup is too big to restore.');
    return value.flatMap((item) => {
      const parsed = parse(item);
      if (parsed === undefined) skipped += 1;
      return parsed === undefined ? [] : [parsed];
    });
  };
  const backup: Backup = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: parseTime(json.exportedAt) ?? new Date(0).toISOString(),
    favourites: uniqueBy(list(json.favourites, parseFavourite), (f) => f.referenceId),
    savedLinks: uniqueBy(list(json.savedLinks, parseSavedLink), (l) => l.url),
    settings: uniqueBy(
      list(json.settings, (row) => (isPortableSetting(row) ? row : undefined)).map(
        ({ key, value }) => ({ key, value }),
      ),
      (row) => row.key,
    ),
    packs: uniqueBy(list(json.packs, parsePack), (p) => p.id),
    references: [],
  };
  const references = uniqueBy(list(json.references, parseReference), (r) => r.id);
  const consistent = withConsistentSources(references);
  skipped += references.length - consistent.length;
  return { backup: { ...backup, references: consistent }, skipped };
}

/** A backup file's text, read and checked. Throws `BackupError` for anything not a backup. */
export function readBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError(NOT_A_BACKUP);
  }
  return parseBackup(json);
}

/** "pop-culture-backup-2026-11-17.json", dated in the reader's own time zone. */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `pop-culture-backup-${day}.json`;
}
