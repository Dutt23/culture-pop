import { normalizePhrase, tokenize } from '../../domain/normalize';
import { containsPhrase, isRecord } from '../retrieval/validate';
import type { EvidenceItem } from './evidence';
import type { SpoilerLevel } from '../../domain/types';
import {
  MAX_CONTEXT_SENTENCES,
  MAX_MEANING_SENTENCES,
  MAX_REWRITES,
  MAX_SENTENCE_CHARS,
} from './jobs';

/**
 * Deterministic checks on model output. Nothing here asks the model how sure it is: a sentence
 * is shown only when its citations are real and its names, numbers and most of its words appear
 * in the evidence it cites; a line is unhidden only when two framings agree and no spoiler word
 * appears; a rewrite is only ever a short search string.
 */

/** WebLLM writes Qwen3's empty "<think>…</think>" block into the answer when thinking is off. */
const THINK_BLOCK = /^\s*<think>[\s\S]*?<\/think>\s*/;

/** Parses model text; undefined on malformed JSON (schema decoding makes that rare, not impossible). */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(THINK_BLOCK, ''));
  } catch {
    return undefined;
  }
}

// ── Grounding ───────────────────────────────────────────────────────────────

/** Function words and sentence openers: neither a name nor content. */
const COMMON_WORDS = new Set(
  (
    'a an the and or but nor so yet for of to in on at by with from into onto over under about ' +
    'after before during while when where what which who whom whose why how than then there here ' +
    'this that these those it its he she him her his hers they them their theirs we us our you your ' +
    'i me my is are was were be been being am has have had do does did will would can could should ' +
    'may might must shall also as if not no only very just more most many much some any each both ' +
    'all other such own same too later eventually however according known called one ones'
  ).split(' '),
);

/** Share of a longer sentence's other content words that must appear (by stem) in the cited evidence. */
export const MIN_SHARED_WORDS = 0.6;
/** Below this many content words, every one must appear: "Doctor Doom dies." has only one. */
const SHORT_SENTENCE_WORDS = 5;
const STEM_CHARS = 5;
const MIN_CONTENT_CHARS = 3;
const POSSESSIVE = /['’]s\b/g;
/** Words that reverse a meaning; a sentence may use one only if its evidence does. */
const NEGATIONS = new Set(
  (
    'not no never nor without cannot isnt arent wasnt werent dont doesnt didnt cant couldnt ' +
    'wont wouldnt shouldnt hasnt havent hadnt aint'
  ).split(' '),
);

function wordsOf(text: string): string[] {
  return tokenize(normalizePhrase(text.replace(POSSESSIVE, '')));
}

/**
 * True when every name (a capitalised word that isn't a common word), number, negation and quoted
 * span in the sentence appears in `cited`, and its other content words do too: all of them in a
 * short sentence, at least `MIN_SHARED_WORDS` in a longer one, matched by the start of a word
 * ("dies" doesn't match "studies"). Strict on purpose: a paraphrase that drops a sentence is a
 * smaller loss than a made-up name, death or reversed meaning that is shown.
 */
export function isGrounded(sentence: string, cited: string): boolean {
  const evidence = ` ${wordsOf(cited).join(' ')} `;
  const hasWord = (word: string) => evidence.includes(` ${word} `);
  const tokens = sentence.replace(POSSESSIVE, '').match(/[\p{L}\p{N}]+/gu) ?? [];
  const names = new Set(
    tokens
      .filter((t) => /\p{N}/u.test(t) || (/^\p{Lu}/u.test(t) && !COMMON_WORDS.has(t.toLowerCase())))
      .map(normalizePhrase),
  );
  const words = wordsOf(sentence);
  if (![...names, ...words.filter((w) => NEGATIONS.has(w))].every(hasWord)) return false;
  const quoted = [...sentence.matchAll(/[“"]([^”"]+)[”"]/g)].map((m) => m[1] ?? '');
  if (!quoted.every((q) => !normalizePhrase(q) || containsPhrase(cited, q))) return false;
  const content = words.filter(
    (w) => w.length >= MIN_CONTENT_CHARS && !COMMON_WORDS.has(w) && !names.has(w),
  );
  if (content.length === 0) return true;
  const shared = content.filter((w) => evidence.includes(` ${w.slice(0, STEM_CHARS)}`)).length;
  return content.length < SHORT_SENTENCE_WORDS
    ? shared === content.length
    : shared / content.length >= MIN_SHARED_WORDS;
}

// ── Job 1: explanation ──────────────────────────────────────────────────────

export type ExplanationField = 'meaning' | 'context' | 'example';

export type DropReason =
  | 'invalid'
  | 'empty'
  | 'too_long'
  | 'too_many'
  | 'duplicate'
  | 'no_citation'
  | 'unknown_id'
  | 'ungrounded'
  | 'unsupported_origin'
  | 'not_a_quote';

export interface CheckedSentence {
  text: string;
  /** Evidence item IDs ("E2") as the model cited them. */
  evidenceIds: string[];
  /** Real `Source` IDs behind them, for the interpretation's citations. */
  sourceIds: string[];
  /** Cites story text, so it is shown only behind Reveal. */
  plot: boolean;
}

export interface DroppedSentence {
  field: ExplanationField;
  text: string;
  reason: DropReason;
}

export type Uncertainty = 'low' | 'medium' | 'high';

export interface ExplanationCheck {
  /** The output was an object with a `meaning` list at all. */
  valid: boolean;
  meaning: CheckedSentence[];
  context: CheckedSentence[];
  /** Only ever an exact quote from the evidence it cites. */
  example?: CheckedSentence;
  /** `major` unless the model said `none` and nothing kept cites story text (fails closed). */
  spoiler: SpoilerLevel;
  /** The model's own caution, for display only; never used to accept or reject anything. */
  uncertainty: Uncertainty;
  dropped: DroppedSentence[];
}

/**
 * Wording that claims where something came from or when it started. Such a sentence is kept only
 * if its cited evidence makes the same kind of claim (and, like every sentence, names its names,
 * dates and numbers).
 */
const ORIGIN_CLAIM =
  /\b(origin\w*|comes? from|came from|first (?:used|said|coined|appeared)|coined|invent\w*|derived?|based on|populari[sz]\w*|started|began|dates? (?:back|from))\b/i;
const MIN_EXAMPLE_WORDS = 2;
const UNCERTAINTY: readonly Uncertainty[] = ['low', 'medium', 'high'];

function stringsIn(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Every kept sentence and the example, in display order. */
export function keptSentences(check: ExplanationCheck): CheckedSentence[] {
  return [...check.meaning, ...check.context, ...(check.example ? [check.example] : [])];
}

const FAILED: Omit<ExplanationCheck, 'dropped'> = {
  valid: false,
  meaning: [],
  context: [],
  spoiler: 'major',
  uncertainty: 'high',
};

/**
 * Validates the structured explanation (see `explainJob`). Each sentence must cite known evidence
 * IDs and pass `isGrounded`; origin or date claims need the same claim in what they cite; the
 * example must be copied word for word from what it cites. Anything else is dropped, and an
 * invalid `spoiler` or `uncertainty` falls back to `major` / `high`.
 */
export function checkExplanation(
  output: unknown,
  items: readonly EvidenceItem[],
): ExplanationCheck {
  if (!isRecord(output) || !Array.isArray(output.meaning)) return { ...FAILED, dropped: [] };
  const byId = new Map(items.map((item) => [item.id, item]));
  const dropped: DroppedSentence[] = [];
  const seen = new Set<string>();

  function check(entry: unknown, field: ExplanationField, index: number, limit: number) {
    const key = field === 'example' ? 'quote' : 'text';
    if (!isRecord(entry) || typeof entry[key] !== 'string' || !Array.isArray(entry.ids)) {
      dropped.push({ field, text: '', reason: 'invalid' });
      return undefined;
    }
    const text = (entry[key] as string).replace(/\s+/g, ' ').trim();
    const ids = [...new Set(stringsIn(entry.ids))];
    const cited = ids.flatMap((id) => byId.get(id) ?? []);
    const citedText = cited.map((c) => c.text).join(' ');
    const reason: DropReason | undefined = !text
      ? 'empty'
      : index >= limit
        ? 'too_many'
        : text.length > MAX_SENTENCE_CHARS
          ? 'too_long'
          : seen.has(normalizePhrase(text))
            ? 'duplicate'
            : ids.length === 0
              ? 'no_citation'
              : cited.length !== ids.length
                ? 'unknown_id'
                : field === 'example'
                  ? tokenize(normalizePhrase(text)).length < MIN_EXAMPLE_WORDS ||
                    !containsPhrase(citedText, text)
                    ? 'not_a_quote'
                    : undefined
                  : !isGrounded(text, citedText)
                    ? 'ungrounded'
                    : ORIGIN_CLAIM.test(text) && !ORIGIN_CLAIM.test(citedText)
                      ? 'unsupported_origin'
                      : undefined;
    if (reason) {
      dropped.push({ field, text, reason });
      return undefined;
    }
    seen.add(normalizePhrase(text));
    return {
      text,
      evidenceIds: ids,
      sourceIds: [...new Set(cited.flatMap((c) => c.sourceIds))],
      plot: cited.some((c) => c.plot),
    };
  }

  const sentences = (field: 'meaning' | 'context', limit: number): CheckedSentence[] => {
    const value = output[field];
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      dropped.push({ field, text: '', reason: 'invalid' });
      return [];
    }
    return value.flatMap((entry: unknown, index) => check(entry, field, index, limit) ?? []);
  };
  const meaning = sentences('meaning', MAX_MEANING_SENTENCES);
  const context = sentences('context', MAX_CONTEXT_SENTENCES);
  const example =
    output.example === undefined || output.example === null
      ? undefined
      : check(output.example, 'example', 0, 1);
  const plot = [...meaning, ...context, ...(example ? [example] : [])].some((s) => s.plot);
  return {
    valid: true,
    meaning,
    context,
    example,
    spoiler: output.spoiler === 'none' && !plot ? 'none' : 'major',
    uncertainty: UNCERTAINTY.find((u) => u === output.uncertainty) ?? 'high',
    dropped,
  };
}

// ── Job 2: spoiler judgement ────────────────────────────────────────────────

/** Words that keep a line hidden whatever the model says: deaths, twists, endings, identities. */
const SPOILER_HINTS =
  /\b(die[sd]?|dying|dead|death|kill\w*|murder\w*|twist|ending|reveal\w*|secret\w*|really|actually|traitor|betray\w*|won|wins?|marr(?:y|ied|ies)|pregnant|sacrific\w*|(?:my|your|his|her) (?:father|mother|son|daughter|brother|sister))\b/i;
export const MAX_SPOILER_LINE_CHARS = 200;

export type SpoilerReason = 'both_safe' | 'hint_word' | 'too_long' | 'not_safe';

export interface SpoilerDecision {
  show: boolean;
  reason: SpoilerReason;
}

/** `first` answers `{verdict}`, `second` answers `{answer}` (see `spoilerJobs`). Unsure means hidden. */
export function decideSpoiler(line: string, first: unknown, second: unknown): SpoilerDecision {
  if (line.length > MAX_SPOILER_LINE_CHARS) return { show: false, reason: 'too_long' };
  if (SPOILER_HINTS.test(line)) return { show: false, reason: 'hint_word' };
  const safe =
    isRecord(first) && first.verdict === 'safe' && isRecord(second) && second.answer === 'no';
  return safe ? { show: true, reason: 'both_safe' } : { show: false, reason: 'not_safe' };
}

// ── Job 3: search rewrites ──────────────────────────────────────────────────

const MAX_REWRITE_WORDS = 8;
const MAX_REWRITE_CHARS = 80;

/** At most three short, distinct search strings that differ from the query; never a sentence or link. */
export function checkRewrites(output: unknown, query: string): string[] {
  if (!isRecord(output)) return [];
  const seen = new Set([normalizePhrase(query)]);
  const rewrites: string[] = [];
  for (const candidate of stringsIn(output.queries)) {
    const text = candidate.replace(/\s+/g, ' ').trim();
    const key = normalizePhrase(text);
    if (
      !key ||
      seen.has(key) ||
      text.length > MAX_REWRITE_CHARS ||
      key.split(' ').length > MAX_REWRITE_WORDS ||
      /https?:|www\./i.test(text)
    ) {
      continue;
    }
    seen.add(key);
    rewrites.push(text);
    if (rewrites.length === MAX_REWRITES) break;
  }
  return rewrites;
}

/**
 * Original results first, then one from each rewrite, round-robin, without repeats: a rewrite can
 * lift a buried answer into the top 5 but never pushes the original's top hit down.
 */
export function mergeResults<T extends { id: string }>(
  lists: readonly (readonly T[])[],
  limit = 10,
): T[] {
  const merged: T[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let rank = 0; rank < longest && merged.length < limit; rank++) {
    for (const list of lists) {
      const item = list[rank];
      if (item && !seen.has(item.id) && merged.length < limit) {
        seen.add(item.id);
        merged.push(item);
      }
    }
  }
  return merged;
}
