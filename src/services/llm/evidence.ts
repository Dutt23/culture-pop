import { encode as encodeToon } from '@toon-format/toon';
import type { Reference, Source } from '../../domain/types';
import { draftFor, isClaimSupported } from '../curation/curate';
import type { GetJson } from '../retrieval/types';
import {
  compactText,
  isRecord,
  safeUrl,
  stringField,
  throwIfMediaWikiError,
} from '../retrieval/validate';

/**
 * Evidence the model may use, built only from what the app already fetched. Each item gets a
 * short ID ("E1") the model cites; the ID maps back to the real `Source` IDs, so a citation the
 * model makes up can't name a source the app doesn't hold.
 */

export interface EvidenceItem {
  id: string;
  /** Publisher(s), shown to the model so it can say "Wikipedia says…" if it wants. */
  from: string;
  text: string;
  sourceIds: string[];
  /** Story text (a character biography): any sentence citing it stays behind Reveal. */
  plot: boolean;
}

export type EvidenceFormat = 'json' | 'toon';

/** A Wikipedia article's character-biography section, kept in memory only. */
export interface StorySection {
  source: Source;
  paragraphs: string[];
}

const HOST = 'en.wikipedia.org';
/** Section names Wikipedia uses for a character's in-story history, most common first. */
const STORY_HEADINGS = [
  'Fictional character biography',
  'Fictional biography',
  'Character biography',
];
/** Small models read a short context best; ~600 tokens of story. */
const MAX_STORY_CHARS = 2400;
const MAX_PARAGRAPH_CHARS = 600;
/** Fixed input budget for one prompt (see `CONTEXT_WINDOW` in models.ts); later items are left out. */
export const MAX_EVIDENCE_CHARS = 4000;

function publishersOf(ids: readonly string[], sources: readonly Source[]): string {
  return [...new Set(ids.flatMap((id) => sources.find((s) => s.id === id)?.publisher ?? []))].join(
    ', ',
  );
}

/**
 * Facts the curator would state (type, year, creators, first appearance), then each source's
 * excerpt, then the story. Quote and dictionary templates only repeat an excerpt, so they are
 * not added twice.
 */
export function buildEvidence(
  reference: Reference | undefined,
  sources: readonly Source[],
  story?: StorySection,
): EvidenceItem[] {
  const draft = reference && draftFor(reference, sources);
  // Only claims whose sources are all present; the curator would mark the rest "Not verified".
  const facts =
    draft && (draft.relation === 'original' || draft.relation === 'related')
      ? draft.claims.filter((claim) => isClaimSupported(claim, sources))
      : [];
  const raw: Omit<EvidenceItem, 'id'>[] = [
    ...facts.map((claim) => ({
      from: publishersOf(claim.sourceIds, sources),
      text: `${claim.text}.`,
      sourceIds: claim.sourceIds,
      plot: false,
    })),
    ...sources.flatMap((s) =>
      s.excerpt ? [{ from: s.publisher, text: s.excerpt, sourceIds: [s.id], plot: false }] : [],
    ),
    ...(story
      ? story.paragraphs.map((text) => ({
          from: 'Wikipedia',
          text,
          sourceIds: [story.source.id],
          plot: true,
        }))
      : []),
  ];
  let used = 0;
  const within = raw.filter((item) => (used += item.text.length) <= MAX_EVIDENCE_CHARS);
  return within.map((item, index) => ({ ...item, id: `E${index + 1}` }));
}

/** What the model sees: ID, publisher and text only. */
export function encodeEvidence(items: readonly EvidenceItem[], format: EvidenceFormat): string {
  const evidence = items.map(({ id, from, text }) => ({ id, from, text }));
  return format === 'toon' ? encodeToon({ evidence }) : JSON.stringify({ evidence });
}

export function storyUrl(title: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    prop: 'extracts|info',
    explaintext: '1',
    exsectionformat: 'wiki',
    inprop: 'url',
    redirects: '1',
    titles: title,
  });
  return `https://${HOST}/w/api.php?${params}`;
}

/** Lines of one section: from its `== Heading ==` to the next heading of the same level. */
function sectionLines(lines: readonly string[], heading: string): string[] | undefined {
  const start = lines.findIndex((l) => l.trim() === `== ${heading} ==`);
  if (start < 0) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^==[^=]/.test(l.trim()));
  return end < 0 ? rest : rest.slice(0, end);
}

/** Paragraphs (subheadings dropped) until the character budget runs out. */
function storyParagraphs(lines: readonly string[]): string[] {
  const paragraphs: string[] = [];
  let used = 0;
  for (const line of lines) {
    const text = line.trim();
    if (!text || text.startsWith('=')) continue;
    const paragraph = compactText(text, MAX_PARAGRAPH_CHARS);
    if (used + paragraph.length > MAX_STORY_CHARS) break;
    paragraphs.push(paragraph);
    used += paragraph.length;
  }
  return paragraphs;
}

/** Parses a full-article plain-text extract; undefined when the page has no story section. */
export function parseStory(json: unknown, retrievedAt: string): StorySection | undefined {
  throwIfMediaWikiError(json);
  if (!isRecord(json) || !isRecord(json.query) || !Array.isArray(json.query.pages))
    return undefined;
  const page: unknown = json.query.pages[0];
  if (!isRecord(page) || typeof page.pageid !== 'number') return undefined;
  const title = stringField(page, 'title');
  const url = safeUrl(page.fullurl, HOST);
  const extract = stringField(page, 'extract');
  if (!title || !url || !extract) return undefined;
  const lines = extract.split('\n');
  const heading = STORY_HEADINGS.find((h) => sectionLines(lines, h));
  const paragraphs = heading ? storyParagraphs(sectionLines(lines, heading) ?? []) : [];
  if (!heading || paragraphs.length === 0) return undefined;
  const anchor = heading.replace(/ /g, '_');
  return {
    source: {
      id: `src:enwiki:${page.pageid}#${anchor}`,
      url: `${url}#${anchor}`,
      title: `${title}: ${heading.toLowerCase()}`,
      publisher: 'Wikipedia',
      sourceType: 'encyclopedia',
      retrievedAt,
      // No excerpt: excerpts are shown openly, and this text is plot.
      license: 'CC BY-SA 4.0',
    },
    paragraphs,
  };
}

/** One request to en.wikipedia.org through the app's HTTP client (host allowlist, size cap). */
export async function fetchStory(
  getJson: GetJson,
  title: string,
  now: string,
  signal?: AbortSignal,
): Promise<StorySection | undefined> {
  return parseStory(await getJson(storyUrl(title), signal), now);
}
