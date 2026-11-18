import { safeHref } from '../../components/ui/safeHref';
import { RetrievalError } from './types';

/** Narrowing helpers for untrusted provider JSON. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * MediaWiki reports API errors, rate limiting included, as HTTP 200 with a top-level
 * `{ error: { code, info } }`; turn that into a failure instead of an empty result.
 */
export function throwIfMediaWikiError(json: unknown): void {
  if (!isRecord(json) || !isRecord(json.error)) return;
  const code = stringField(json.error, 'code');
  const failure = code === 'ratelimited' || code === 'maxlag' ? 'rate_limited' : 'bad_response';
  throw new RetrievalError(failure, `MediaWiki error: ${code ?? 'unknown'}`);
}

/**
 * Only https links on the expected host survive, so provider data can't inject other URLs. It is
 * the render-time check (`safeHref`: https, no username or password) plus the host check, so a
 * link stored here is never one the page would later refuse.
 */
export function safeUrl(value: unknown, host: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const href = safeHref(value);
  return href !== undefined && new URL(href).hostname === host ? href : undefined;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};
const MAX_CODE_POINT = 0x10ffff;

function decodeEntity(match: string, name: string): string {
  if (name[0] !== '#') return NAMED_ENTITIES[name.toLowerCase()] ?? match;
  const hex = name[1] === 'x' || name[1] === 'X';
  const code = hex ? parseInt(name.slice(2), 16) : Number(name.slice(1));
  const valid = Number.isInteger(code) && code > 0 && code <= MAX_CODE_POINT;
  return valid ? String.fromCodePoint(code) : '';
}

/**
 * Search snippets and show summaries arrive as HTML. Keep only their text: the result is always
 * rendered as text, never as HTML. Block tags become spaces so paragraphs don't run together.
 */
export function htmlToText(value: string): string {
  return value
    .replace(/<\/?(p|br|div|li|ul|ol|h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,8});/gi, decodeEntity);
}

export { containsPhrase } from '../../../api/_lib/grounding.js';

const MAX_EXCERPT_CHARS = 320;

/** Collapses whitespace and caps length at a word boundary. */
export function compactText(value: string, maxChars = MAX_EXCERPT_CHARS): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
