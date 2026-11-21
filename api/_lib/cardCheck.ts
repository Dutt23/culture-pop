// Server checks run on every model answer before anything reaches the reader: they drop
// unsupported sentences, bad examples and made-up names, and map evidence ids to request sources.
import type { ModelAnswer } from './cardPrompt.js';
import type {
  CardKind,
  CitedLine,
  DraftCard,
  EvidenceItem,
  NotUsed,
  ToneCard,
} from '../../shared/cardTypes.js';
import { COMMON_WORDS, isGrounded } from '../../shared/grounding.js';

export type CheckResult =
  | { card: DraftCard; notUsed: NotUsed[] }
  | { card: null; reason: 'unreadable' | 'unclear' | 'nothing_left' };

const MAX_LINE_CHARS = 280;
const MAX_SUMMARY = 2;
const MAX_CONTEXT = 3;
const MIN_PREFIX_CHARS = 4;
const TONE_RUN_WORDS = 4;
const WHY_CHARS = 80;
const LABEL_CHARS = 60;
const GIST_CHARS = 120;
const MEANS_CHARS = 280;
const REPLY_CHARS = 80;
const EXAMPLE_CHARS = 280;
const FALLBACK_WHY = 'about something else';
const FALLBACK_MEANS = 'Ask what they mean.';
const FALLBACK_REPLY = 'What do you mean?';
const GENERIC_REPLY =
  /^(nice( one)?|good luck( with that)?|fair (point|enough)|got it|cool|classic|same|sounds (wild|good|fun)|bring it on|nice move)[.!? ,]*$/i;
const POSSESSIVE = /['’]s$/;
/** Lower-case words that describe a source rather than state a fact (names keep their capitals). */
const REPORTING_WORDS =
  /\b(?:described|cited|identified|named|listed|called|calls|says|said|source|sources|example|examples|among|appears|mentioned|regarded)\b/g;
const STRICT_SHARED_WORDS = 0.7;
/** A topic gist or takeaway that talks about the evidence instead of the subject. */
const ABOUT_THE_EVIDENCE =
  /\b(?:the|these|this|those) (?:evidence|sources?|passages?|results|entries|items)\b|\b(?:too )?little (?:detail|context|information)\b|\blimited (?:\w+ )?(?:detail|context|information|overview)\b|\bnot enough (?:detail|context|information)\b/i;

type Line = { t: string; ids: string[] };
type ByIdMap = ReadonlyMap<string, EvidenceItem>;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isLine = (v: unknown): v is Line =>
  isRecord(v) &&
  typeof v.t === 'string' &&
  Array.isArray(v.ids) &&
  v.ids.every((i) => typeof i === 'string');
const isIgnored = (v: unknown): v is { id: string; why: string } =>
  isRecord(v) && typeof v.id === 'string' && typeof v.why === 'string';

function readAnswer(a: unknown): ModelAnswer | null {
  if (!isRecord(a)) return null;
  const ok =
    ['label', 'gist', 'means', 'reply'].every((k) => typeof a[k] === 'string') &&
    Array.isArray(a.summary) &&
    a.summary.every(isLine) &&
    Array.isArray(a.context) &&
    a.context.every(isLine) &&
    (a.example === null || isLine(a.example)) &&
    (a.spoiler === 'none' || a.spoiler === 'major') &&
    typeof a.unclear === 'boolean' &&
    Array.isArray(a.ignored) &&
    a.ignored.every(isIgnored);
  return ok ? (a as unknown as ModelAnswer) : null;
}

const wordsOf = (s: string): string[] => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** The items a line cites, or null when it cites none or any unknown id. */
function citedItems(ids: string[], byId: ByIdMap): EvidenceItem[] | null {
  const found = ids.map((id) => byId.get(id));
  if (found.length === 0 || found.some((f) => !f)) return null;
  return found as EvidenceItem[];
}

const sourcesOf = (cited: EvidenceItem[]): number[] => [...new Set(cited.map((c) => c.source))];

/** Lines whose ids all exist, whose words the cited items support, and that are short enough. */
function topicGrounded(text: string, evidence: string): boolean {
  const claim = text
    .replace(/,? according to (?:the )?(?:passage|source|evidence)\.?$/i, '')
    .replace(/\b(?:said|reported|described) to (have|be)\b/gi, '$1');
  const checked = /[“"]/.test(text)
    ? text
    : claim.replace(
        /\b(\p{Lu}\p{L}*)\s+(\p{Lu}\p{L}*)\b/gu,
        (pair, first: string, second: string) => {
          const joined = `${first}${second}`;
          return wordsOf(evidence).includes(joined.toLowerCase()) ? joined : pair;
        },
      );
  if (isGrounded(checked, evidence)) return true;
  // Words about the source ("is cited as", "the source says") aren't claims; without them, demand
  // more of what's left so a reworded unsupported claim can't slip under the usual share.
  const unreported = checked.replace(REPORTING_WORDS, ' ');
  return unreported !== checked && isGrounded(unreported, evidence, STRICT_SHARED_WORDS);
}

/**
 * What an item vouches for: its title and its text. A dictionary entry names the phrase only in
 * its title ("no cap"), so without it no sentence naming the phrase could pass.
 */
const evidenceOf = (item: EvidenceItem): string => `${item.title}. ${item.text}`;

function keepLines(lines: Line[], byId: ByIdMap, max: number, topic = false): CitedLine[] {
  const kept: CitedLine[] = [];
  for (const line of lines) {
    if (kept.length === max) break;
    const cited = citedItems(line.ids, byId);
    if (!cited || line.t.length > MAX_LINE_CHARS) continue;
    const evidence = cited.map(evidenceOf).join(' ');
    const grounded = topic ? topicGrounded : isGrounded;
    if (grounded(line.t, evidence)) kept.push({ text: line.t, sources: sourcesOf(cited) });
  }
  return kept;
}

const flatten = (s: string): string =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.!?]+$/, '')
    .trim()
    .toLowerCase();

/** Whole words only: the full search at any length, or a leading run of 4+ characters. */
function containsSearch(line: string, search: string): boolean {
  const padded = ` ${wordsOf(line).join(' ')} `;
  const words = wordsOf(search);
  for (let n = words.length; n > 0; n--) {
    const prefix = words.slice(0, n).join(' ');
    const longEnough = n === words.length || prefix.length >= MIN_PREFIX_CHARS;
    if (longEnough && padded.includes(` ${prefix} `)) return true;
  }
  return false;
}

function keepExample(example: Line | null, byId: ByIdMap, search: string): CitedLine | null {
  if (!example || example.t.length > EXAMPLE_CHARS) return null;
  const cited = citedItems(example.ids, byId);
  const line = flatten(example.t);
  if (!cited || !line || !cited.some((c) => flatten(c.text).includes(line))) return null;
  if (!containsSearch(line, search)) return null;
  return { text: example.t, sources: sourcesOf(cited) };
}

/** A number or capitalised word (first token exempt unless `checkFirst`) found in no evidence item. */
function hasUnknownName(text: string, evidenceText: string, checkFirst = false): boolean {
  const raw = text.match(/[\p{L}\p{N}]+(?:['’]s)?/gu) ?? [];
  const tokens = raw.map((t) => t.replace(POSSESSIVE, ''));
  return tokens.some((tok, i) => {
    const isName =
      /\p{N}/u.test(tok) ||
      ((checkFirst || i > 0) && /^\p{Lu}/u.test(tok) && !COMMON_WORDS.has(tok.toLowerCase()));
    return isName && !evidenceText.includes(tok.toLowerCase());
  });
}

function fourWordRuns(words: string[]): string[] {
  const runs: string[] = [];
  for (let i = 0; i + TONE_RUN_WORDS <= words.length; i++) {
    runs.push(words.slice(i, i + TONE_RUN_WORDS).join(' '));
  }
  return runs;
}

/** Shares four words in a row with any tone card field, or is a tone card's reply. */
function copiesTone(text: string, tones: readonly ToneCard[]): boolean {
  const words = wordsOf(text);
  const plain = words.join(' ');
  const runs = new Set(fourWordRuns(words));
  return tones.some(
    (tone) =>
      plain === wordsOf(tone.reply).join(' ') ||
      Object.values(tone).some((field) => fourWordRuns(wordsOf(field)).some((r) => runs.has(r))),
  );
}

/** The search cut to whole words that fit the label limit. */
function searchLabel(search: string): string {
  let label = '';
  for (const word of search.trim().split(/\s+/)) {
    const next = label ? `${label} ${word}` : word;
    if (next.length > LABEL_CHARS) break;
    label = next;
  }
  return label;
}

export function checkAnswer(
  answer: unknown,
  items: readonly EvidenceItem[],
  search: string,
  tones: readonly ToneCard[],
  kind: CardKind = 'reference',
): CheckResult {
  const a = readAnswer(answer);
  if (!a) return { card: null, reason: 'unreadable' };
  if (a.unclear && kind === 'reference') return { card: null, reason: 'unclear' };

  const byId = new Map(items.map((i) => [i.id, i]));
  const summary = keepLines(
    a.summary,
    byId,
    kind === 'reference' ? MAX_SUMMARY : 10,
    kind !== 'reference',
  );
  if (summary.length === 0) return { card: null, reason: 'nothing_left' };
  const context = keepLines(
    a.context,
    byId,
    kind === 'reference' ? MAX_CONTEXT : 10,
    kind !== 'reference',
  );
  const example = keepExample(a.example, byId, search);

  const evidenceText = items.map((i) => evidenceOf(i).toLowerCase()).join('\n');
  const free = (text: string, max: number, fallback: string, checkFirst = false) => {
    const t = text.trim();
    const bad = hasUnknownName(t, evidenceText, checkFirst) || copiesTone(t, tones);
    return !t || t.length > max || bad ? fallback : text;
  };
  const label = free(a.label, LABEL_CHARS, searchLabel(search), true);
  const meta = (text: string) => kind !== 'reference' && ABOUT_THE_EVIDENCE.test(text);
  const firstLine = summary[0]?.text ?? '';
  const gist = meta(a.gist) ? firstLine : free(a.gist, GIST_CHARS, firstLine);
  const means = meta(a.means)
    ? (context[0]?.text ?? summary[1]?.text ?? summary[0]?.text ?? FALLBACK_MEANS)
    : free(a.means, MEANS_CHARS, FALLBACK_MEANS);
  const reply = GENERIC_REPLY.test(a.reply.trim())
    ? FALLBACK_REPLY
    : free(a.reply, REPLY_CHARS, FALLBACK_REPLY);

  const seen = new Set<number>();
  const notUsed = a.ignored.flatMap(({ id, why }) => {
    const item = byId.get(id);
    if (!item || seen.has(item.source)) return [];
    seen.add(item.source);
    const reason = why.trim().slice(0, WHY_CHARS).trim();
    return [{ source: item.source, why: reason || FALLBACK_WHY }];
  });

  if (kind !== 'reference') {
    const cited = new Set(
      [...summary, ...context, ...(example ? [example] : [])].flatMap((line) => line.sources),
    );
    for (const item of items) {
      if (!cited.has(item.source) && !seen.has(item.source)) {
        seen.add(item.source);
        notUsed.push({ source: item.source, why: 'No supported claim included from this source' });
      }
    }
  }
  return {
    card: {
      ...(kind !== 'reference' ? { kind, partial: a.unclear || notUsed.length > 0 } : {}),
      label,
      gist,
      means,
      reply,
      summary,
      context,
      example,
      spoiler: a.spoiler,
    },
    notUsed,
  };
}
