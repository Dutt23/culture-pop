import { checkAccess, type AccessResult } from './_lib/access.js';
import { checkAnswer } from './_lib/cardCheck.js';
import { curateEvidence } from './_lib/cardCurate.js';
import { ANSWER_SCHEMA, PREFIX, PROMPT_VERSION, requestText } from './_lib/cardPrompt.js';
import {
  ProviderError,
  draftWithFallback,
  providersFromEnv,
  type DraftProvider,
} from './_lib/cardProviders.js';
import {
  LIMITS,
  type DraftRequestBody,
  type DraftResponse,
  type DraftSourceInput,
  type EvidenceItem,
  type NotUsed,
  type ToneCard,
} from './_lib/cardTypes.js';
import { devFlag } from './_lib/devFlags.js';
import { isCrossSite, json, readCapped } from './_lib/http.js';
import { extractPages } from './_lib/parallelExtract.js';
import { cut, validAbout, validQuery } from './_lib/text.js';

/**
 * Curates the reader's picked search results and app cards into one AI-drafted, checked card.
 * Provider keys stay on the server. Never logs or stores bodies, answers or keys.
 */

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_TITLE = 200;
const MIN_SNIPPET = 40;
const MODEL_TIMEOUT_MS = 20_000;
/** Per instance, same pattern as web-search; the providers' spend limits are the real cap. */
const DAILY_DRAFT_CAP = 50;
const KINDS = new Set(['wiki', 'web', 'app']);
const WIKI_FROM = new Set(['wikipedia', 'wiktionary', 'wikiquote', 'wikidata']);
const APP_FROM = new Set(['app card', 'your card']);
const TONE_FIELDS = ['label', 'gist', 'means', 'reply', 'summary'] as const;

export interface DraftHandlerOptions {
  fetch?: typeof fetch;
  now?: () => Date;
  checkAccess?: (request: Request) => AccessResult;
  dailyCap?: number;
  providers?: DraftProvider[];
}

const URLS = /https?:\/\/\S+/g;
/** No link may reach the model, whichever field it hides in. */
const stripUrls = (text: string) => text.replace(URLS, '');
const clean = (text: string) => stripUrls(text).replace(/\s+/g, ' ').trim();

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function readSource(raw: unknown): DraftSourceInput | null {
  if (!isObject(raw) || typeof raw.kind !== 'string' || !KINDS.has(raw.kind)) return null;
  if (typeof raw.from !== 'string' || typeof raw.title !== 'string') return null;
  const kind = raw.kind as DraftSourceInput['kind'];
  const title = cut(clean(raw.title), MAX_TITLE);
  if (!raw.from.trim() || !title) return null;
  const allowedFrom = kind === 'wiki' ? WIKI_FROM : APP_FROM;
  if (kind !== 'web' && !allowedFrom.has(raw.from)) return null;
  const base = { kind, from: raw.from, title };
  if (kind === 'web') {
    const url = httpsUrl(raw.url);
    if (!url) return null;
    const text = typeof raw.text === 'string' ? cut(raw.text, LIMITS.itemChars) : undefined;
    return { ...base, url, ...(text === undefined ? {} : { text }) };
  }
  return isText(raw.text) ? { ...base, text: cut(raw.text, LIMITS.itemChars) } : null;
}

function readTone(raw: unknown): ToneCard | null {
  if (!isObject(raw) || TONE_FIELDS.some((f) => typeof raw[f] !== 'string')) return null;
  const field = (f: (typeof TONE_FIELDS)[number]) =>
    cut(clean(raw[f] as string), LIMITS.toneFieldChars);
  return {
    label: field('label'),
    gist: field('gist'),
    means: field('means'),
    reply: field('reply'),
    summary: field('summary'),
  };
}

/** The validated request, or null for anything outside the limits (over-long text is cut). */
export function readDraftBody(raw: unknown): DraftRequestBody | null {
  if (!isObject(raw)) return null;
  const search = validQuery(typeof raw.search === 'string' ? clean(raw.search) : null);
  if (!search) return null;
  if (!Array.isArray(raw.sources) || raw.sources.length < 1) return null;
  if (raw.sources.length > LIMITS.sources) return null;
  const sources = raw.sources.map(readSource);
  if (sources.some((s) => s === null)) return null;
  const valid = sources as DraftSourceInput[];
  const urls = valid.filter((s) => s.kind === 'web').map((s) => s.url);
  if (urls.length > LIMITS.webSources || new Set(urls).size !== urls.length) return null;

  let tones: ToneCard[] = [];
  if (raw.tones !== undefined) {
    if (!Array.isArray(raw.tones) || raw.tones.length > LIMITS.tones) return null;
    const read = raw.tones.map(readTone);
    if (read.some((t) => t === null)) return null;
    tones = read as ToneCard[];
  }
  return { search, about: validAbout(raw.about), sources: valid, tones };
}

/** The `www.`-less host a reader would recognise. */
const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

type Candidate = Omit<EvidenceItem, 'id' | 'role'>;

/** Each source becomes a candidate item (keeping its index), or goes to `unread`. */
function toCandidates(
  sources: readonly DraftSourceInput[],
  pages: ReadonlyMap<string, string | null>,
): { candidates: Candidate[]; unread: NotUsed[] } {
  const candidates: Candidate[] = [];
  const unread: NotUsed[] = [];
  sources.forEach((s, source) => {
    let text = s.text ?? '';
    let from = s.from;
    if (s.kind === 'web') {
      from = hostOf(s.url ?? '');
      const page = pages.get(s.url ?? '');
      const snippet = stripUrls(s.text ?? '').trim();
      text = page ?? (snippet.length >= MIN_SNIPPET ? snippet : '');
      if (!text) return void unread.push({ source, why: "couldn't be read" });
    }
    candidates.push({ from, title: s.title, text: stripUrls(cut(text, LIMITS.itemChars)), source });
  });
  return { candidates, unread };
}

const firstPerSource = (all: readonly NotUsed[]): NotUsed[] =>
  all.filter((n, i) => all.findIndex((m) => m.source === n.source) === i);

export function createDraftHandler(
  options: DraftHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const doFetch =
    options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const dailyCap = options.dailyCap ?? DAILY_DRAFT_CAP;
  const now = options.now ?? (() => new Date());
  const access = options.checkAccess ?? ((request) => checkAccess(request, now().getTime()));
  // shortcut: per-instance memory, so cold starts and parallel instances each get their own count;
  // the providers' spend limits are the real cap. Upgrade to a shared store if use grows.
  let day = '';
  let used = 0;

  return async function handle(request) {
    if (isCrossSite(request)) return json(403, { error: 'cross_site' });
    const allowed = access(request);
    if (allowed === 'not_configured') return json(503, { error: 'not_configured' });
    if (allowed === 'locked') return json(401, { error: 'locked' });

    let body: DraftRequestBody | null;
    try {
      body = readDraftBody(JSON.parse(await readCapped(request, MAX_REQUEST_BYTES)));
    } catch {
      body = null;
    }
    if (!body) return json(400, { error: 'bad_request' });

    const providers = options.providers ?? providersFromEnv(process.env, doFetch);
    if (providers.length === 0) return json(503, { error: 'not_configured' });

    const today = now().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      used = 0;
    }
    if (used >= dailyCap) return json(429, { error: 'daily_cap' });
    used++;

    const { search, sources, tones = [] } = body;
    const urls = sources.flatMap((s) => (s.kind === 'web' && s.url ? [s.url] : []));
    const apiKey = process.env.PARALLEL_API_KEY;
    const canExtract = urls.length > 0 && (apiKey || devFlag('WEB_SEARCH_FAKE'));
    const pages = canExtract
      ? await extractPages(urls, search, { fetch: doFetch, apiKey: apiKey ?? 'local-fake' })
      : new Map<string, string | null>();

    const { candidates, unread } = toCandidates(sources, pages);
    const { items: curated, dropped } = curateEvidence(candidates, search);
    const early = [...unread, ...dropped];
    // Whole items are dropped, never cut, so no sentence loses its end.
    let total = 0;
    const items = curated.filter((item) => {
      if (total + item.text.length > LIMITS.totalChars) {
        early.push({ source: item.source, why: 'over the length limit' });
        return false;
      }
      total += item.text.length;
      return true;
    });
    if (items.length === 0) {
      const notUsed = firstPerSource(early);
      return json(422, { error: 'no_card', reason: 'nothing_left', notUsed });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
    let drafted;
    try {
      drafted = await draftWithFallback(
        providers,
        {
          prefix: PREFIX,
          user: requestText({ search, about: body.about, evidence: items, tones }),
          schema: ANSWER_SCHEMA,
        },
        controller.signal,
      );
    } catch (error) {
      // Not logged: the error could echo the request.
      const kind = error instanceof ProviderError ? error.kind : 'failed';
      if (kind === 'out_of_credit') return json(503, { error: 'out_of_credit' });
      if (kind === 'rate_limited') return json(429, { error: 'rate_limited' });
      return json(502, { error: 'provider_failed' });
    } finally {
      clearTimeout(timer);
    }

    const checked = checkAnswer(drafted.answer, items, search, tones);
    if (!checked.card) {
      const notUsed = firstPerSource(early);
      return json(422, { error: 'no_card', reason: checked.reason, notUsed });
    }
    const response: DraftResponse = {
      card: checked.card,
      notUsed: firstPerSource([...early, ...checked.notUsed]),
      provider: drafted.provider,
      promptVersion: PROMPT_VERSION,
    };
    return json(200, response);
  };
}

export const POST = createDraftHandler();
