// Server checks run on every model answer before anything reaches the reader: they drop
// unsupported sentences, bad examples and made-up names, and map evidence ids to request sources.
import type { ModelAnswer } from './cardPrompt.js';
import type { CitedLine, DraftCard, EvidenceItem, NotUsed, ToneCard } from './cardTypes.js';
import { COMMON_WORDS, isGrounded } from './grounding.js';

export type CheckResult =
  | { card: DraftCard; notUsed: NotUsed[] }
  | { card: null; reason: 'unreadable' | 'unclear' | 'nothing_left' };

const MAX_LINE_CHARS = 280;
const MAX_SUMMARY = 2;
const MAX_CONTEXT = 3;
const MIN_PREFIX_CHARS = 4;
const TONE_RUN_WORDS = 4;
const WHY_CHARS = 80;
const FALLBACK_MEANS = 'Ask what they mean.';
const FALLBACK_REPLY = 'What do you mean?';
const GENERIC_REPLY =
  /^(nice( one)?|good luck( with that)?|fair (point|enough)|got it|cool|classic|same|sounds (wild|good|fun)|bring it on|nice move)[.!? ,]*$/i;
const POSSESSIVE = /['’]s$/;

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
function keepLines(lines: Line[], byId: ByIdMap, max: number): CitedLine[] {
  const kept: CitedLine[] = [];
  for (const line of lines) {
    if (kept.length === max) break;
    const cited = citedItems(line.ids, byId);
    if (!cited || line.t.length > MAX_LINE_CHARS) continue;
    if (!isGrounded(line.t, cited.map((c) => c.text).join(' '))) continue;
    kept.push({ text: line.t, sources: sourcesOf(cited) });
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

/** The line holds the whole search, or a leading run of its whole words of 4+ characters. */
function containsSearch(line: string, search: string): boolean {
  const words = flatten(search).split(/\s+/).filter(Boolean);
  for (let n = words.length; n > 0; n--) {
    const prefix = words.slice(0, n).join(' ');
    if (prefix.length >= MIN_PREFIX_CHARS && line.includes(prefix)) return true;
  }
  return false;
}

function keepExample(example: Line | null, byId: ByIdMap, search: string): CitedLine | null {
  if (!example) return null;
  const cited = citedItems(example.ids, byId);
  const line = flatten(example.t);
  if (!cited || !line || !cited.some((c) => flatten(c.text).includes(line))) return null;
  if (!containsSearch(line, search)) return null;
  return { text: example.t, sources: sourcesOf(cited) };
}

/** A number, or a capitalised word that is not the first token, that no evidence item contains. */
function hasUnknownName(text: string, evidenceText: string): boolean {
  const raw = text.match(/[\p{L}\p{N}]+(?:['’]s)?/gu) ?? [];
  const tokens = raw.map((t) => t.replace(POSSESSIVE, ''));
  return tokens.some((tok, i) => {
    const isName =
      /\p{N}/u.test(tok) ||
      (i > 0 && /^\p{Lu}/u.test(tok) && !COMMON_WORDS.has(tok.toLowerCase()));
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

export function checkAnswer(
  answer: unknown,
  items: readonly EvidenceItem[],
  search: string,
  tones: readonly ToneCard[],
): CheckResult {
  const a = readAnswer(answer);
  if (!a) return { card: null, reason: 'unreadable' };
  if (a.unclear) return { card: null, reason: 'unclear' };

  const byId = new Map(items.map((i) => [i.id, i]));
  const summary = keepLines(a.summary, byId, MAX_SUMMARY);
  if (summary.length === 0) return { card: null, reason: 'nothing_left' };
  const context = keepLines(a.context, byId, MAX_CONTEXT);
  const example = keepExample(a.example, byId, search);

  const evidenceText = items.map((i) => i.text.toLowerCase()).join('\n');
  const bad = (text: string) => hasUnknownName(text, evidenceText) || copiesTone(text, tones);
  const gist = bad(a.gist) ? (summary[0]?.text ?? '') : a.gist;
  const means = bad(a.means) ? FALLBACK_MEANS : a.means;
  const reply = bad(a.reply) || GENERIC_REPLY.test(a.reply.trim()) ? FALLBACK_REPLY : a.reply;

  const notUsed = a.ignored.flatMap(({ id, why }) => {
    const item = byId.get(id);
    return item ? [{ source: item.source, why: why.trim().slice(0, WHY_CHARS) }] : [];
  });

  return {
    card: { label: a.label, gist, means, reply, summary, context, example, spoiler: a.spoiler },
    notUsed,
  };
}
