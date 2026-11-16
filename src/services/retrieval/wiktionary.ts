import type { GetJson } from './types';
import { compactText, isRecord, stringField, throwIfMediaWikiError } from './validate';

const HOST = 'en.wiktionary.org';
const ENGLISH_SECTION = /^== English ==$/m;
const LEVEL_TWO_HEADING = /^== [^=].* ==$/m;
const PART_OF_SPEECH =
  /^={3,4} (Phrase|Proverb|Idiom|Interjection|Noun|Verb|Adjective|Adverb|Prepositional phrase) ={3,4}$/;
const POINTER_DEFINITION = /^(Alternative|Obsolete|Archaic) (form|spelling) of|^Misspelling of/i;

export interface WiktionaryEntry {
  title: string;
  url: string;
  definition: string;
}

/** Wiktionary titles are case-sensitive; ask for the lowercase and the as-typed form in one call. */
export function wiktionaryUrl(query: string): string {
  const typed = query.trim();
  const titles = [...new Set([typed.toLowerCase(), typed])].join('|');
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    prop: 'extracts',
    titles,
    explaintext: '1',
    exsectionformat: 'wiki',
    redirects: '1',
  });
  return `https://${HOST}/w/api.php?${params}`;
}

/** The headword line repeats the title, optionally followed by inflections: "point break (plural …)". */
function isHeadword(line: string, title: string): boolean {
  const lower = line.toLowerCase();
  const head = title.toLowerCase();
  return lower === head || lower.startsWith(`${head} (`);
}

/** First real English definition: the line after the headword under a part-of-speech heading. */
export function firstEnglishDefinition(extract: string, title: string): string | undefined {
  const start = extract.search(ENGLISH_SECTION);
  if (start < 0) return undefined;
  const afterHeading = extract.slice(start).replace(ENGLISH_SECTION, '');
  const end = afterHeading.search(LEVEL_TWO_HEADING);
  const lines = (end < 0 ? afterHeading : afterHeading.slice(0, end))
    .split('\n')
    .map((l) => l.trim());

  let inPartOfSpeech = false;
  for (const line of lines) {
    if (line.startsWith('==')) {
      inPartOfSpeech = PART_OF_SPEECH.test(line);
      continue;
    }
    if (!inPartOfSpeech || !line || isHeadword(line, title)) continue;
    if (POINTER_DEFINITION.test(line)) return undefined;
    return compactText(line);
  }
  return undefined;
}

export function parseWiktionary(json: unknown): WiktionaryEntry | undefined {
  if (!isRecord(json) || !isRecord(json.query) || !Array.isArray(json.query.pages))
    return undefined;
  for (const page of json.query.pages) {
    if (!isRecord(page) || 'missing' in page) continue;
    const title = stringField(page, 'title');
    const extract = stringField(page, 'extract');
    if (!title || !extract) continue;
    const definition = firstEnglishDefinition(extract, title);
    if (definition) {
      return {
        title,
        url: `https://${HOST}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        definition,
      };
    }
  }
  return undefined;
}

export async function lookUpWiktionary(
  query: string,
  getJson: GetJson,
  signal?: AbortSignal,
): Promise<WiktionaryEntry | undefined> {
  const json = await getJson(wiktionaryUrl(query), signal);
  throwIfMediaWikiError(json);
  return parseWiktionary(json);
}
