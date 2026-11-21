import { checkWebAccess, WEB_ACCESS_REFUSALS, type WebAccess } from './_lib/webAccess.js';
import { checkAnswer } from './_lib/cardCheck.js';
import { curateEvidence } from '../shared/cardCurate.js';
import {
  ANSWER_SCHEMA,
  PREFIX,
  PROMPT_VERSION,
  TOPIC_PREFIX,
  TOPIC_PROMPT_VERSION,
  requestText,
} from './_lib/cardPrompt.js';
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
} from '../shared/cardTypes.js';
import { devFlag } from './_lib/devFlags.js';
import { withDraftStream } from './_lib/draftStream.js';
import { isCrossSite, json, readCapped } from './_lib/http.js';
import { extractPages } from './_lib/parallelExtract.js';
import { bestSnippet, dropFanWorks, isFanSite } from './_lib/snippet.js';
import { cut, validAbout, validQuery } from '../shared/text.js';

/**
 * Curates the reader's picked search results and app cards into one AI-drafted, checked card.
 * Provider keys stay on the server. Never logs or stores bodies, answers or keys.
 */

// 80 KB accommodates ten bounded sources, titles, URLs and tones, including 4-byte text.
const MAX_REQUEST_BYTES = 80 * 1024;
const MAX_TITLE = 200;
const MIN_SNIPPET = 40;
/** From the request's start: under the app's 25 s wait, so the reader always gets our answer. */
const DEADLINE_MS = 23_000;
const KINDS = new Set(['wiki', 'web', 'app']);
const WIKI_FROM = new Set(['wikipedia', 'wiktionary', 'wikiquote', 'wikidata']);
const APP_FROM = new Set(['app card', 'your card']);
const TONE_FIELDS = ['label', 'gist', 'means', 'reply', 'summary'] as const;

export interface DraftHandlerOptions {
  fetch?: typeof fetch;
  /** Who may use the wider web; defaults to the signed-in person's permission (webAccess.ts). */
  checkAccess?: (request: Request) => WebAccess | Promise<WebAccess>;
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
  if (raw.provenance !== undefined && raw.provenance !== 'user') return null;
  const base = {
    kind,
    from: raw.from,
    title,
    ...(raw.provenance === 'user' ? { provenance: 'user' as const } : {}),
  };
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

  if (
    raw.kind !== undefined &&
    !['reference', 'topic', 'list', 'ranking'].includes(String(raw.kind))
  )
    return null;
  if (raw.userContext !== undefined && typeof raw.userContext !== 'string') return null;
  let retry: DraftRequestBody['retry'];
  if (raw.retry !== undefined) {
    if (
      !isObject(raw.retry) ||
      !Array.isArray(raw.retry.preserveSources) ||
      raw.retry.preserveSources.length > LIMITS.sources ||
      raw.retry.preserveSources.some((n) => !Number.isInteger(n) || n < 0 || n >= valid.length)
    )
      return null;
    retry = { preserveSources: [...new Set(raw.retry.preserveSources as number[])] };
  }
  let tones: ToneCard[] = [];
  if (raw.tones !== undefined) {
    if (!Array.isArray(raw.tones) || raw.tones.length > LIMITS.tones) return null;
    const read = raw.tones.map(readTone);
    if (read.some((t) => t === null)) return null;
    tones = read as ToneCard[];
  }
  let styleGuidance: DraftRequestBody['styleGuidance'];
  if (raw.styleGuidance !== undefined) {
    const guidance = raw.styleGuidance;
    if (
      !isObject(guidance) ||
      typeof guidance.tone !== 'string' ||
      typeof guidance.structure !== 'string'
    )
      return null;
    styleGuidance = {
      tone: cut(clean(guidance.tone), LIMITS.styleGuidanceChars),
      structure: cut(clean(guidance.structure), LIMITS.styleGuidanceChars),
    };
  }
  return {
    search,
    about: validAbout(raw.about),
    sources: valid,
    ...(raw.kind ? { kind: raw.kind as DraftRequestBody['kind'] } : {}),
    ...(typeof raw.userContext === 'string'
      ? { userContext: cut(clean(raw.userContext), LIMITS.itemChars) }
      : {}),
    ...(retry ? { retry } : {}),
    tones,
    ...(styleGuidance ? { styleGuidance } : {}),
  };
}

/** The `www.`-less host a reader would recognise. */
const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

type Candidate = Omit<EvidenceItem, 'id' | 'role'>;

/** Each source becomes a candidate item (keeping its index), or goes to `unread`. */
function toCandidates(
  sources: readonly DraftSourceInput[],
  pages: ReadonlyMap<string, string | null>,
  search: string,
  kind: DraftRequestBody['kind'],
): { candidates: Candidate[]; unread: NotUsed[] } {
  const candidates: Candidate[] = [];
  const unread: NotUsed[] = [];
  sources.forEach((s, source) => {
    let text = s.text ?? '';
    let from = s.from;
    if (s.kind === 'web') {
      from = hostOf(s.url ?? '');
      if (isFanSite(from)) {
        return void unread.push({ source, why: 'fan-made site, not the original work' });
      }
      // Fan-work fragments never reach packing, so they can't become the best-scoring anchor.
      const raw = pages.get(s.url ?? '');
      const page = raw && dropFanWorks(raw);
      const snippet = dropFanWorks(stripUrls(s.text ?? '').trim());
      // Anchor ranking to the picked result to reduce subject drift from generic query words.
      text =
        page && kind && kind !== 'reference' && Array.from(page).length > LIMITS.itemChars
          ? bestSnippet([page], `${search} ${snippet}`, 2)
          : (page ?? (snippet.length >= MIN_SNIPPET ? snippet : ''));
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
  const access =
    options.checkAccess ?? ((request: Request) => checkWebAccess(request, 'card_draft'));

  return async function handle(request) {
    const started = Date.now();
    if (isCrossSite(request)) return json(403, { error: 'cross_site' });
    const allowed = await access(request);
    if (allowed !== 'ok') {
      const refusal = WEB_ACCESS_REFUSALS[allowed];
      return json(refusal.status, { error: refusal.error });
    }

    let body: DraftRequestBody | null;
    try {
      body = readDraftBody(JSON.parse(await readCapped(request, MAX_REQUEST_BYTES)));
    } catch {
      body = null;
    }
    if (!body) return json(400, { error: 'bad_request' });

    const providers = options.providers ?? providersFromEnv(process.env, doFetch);
    if (providers.length === 0) return json(503, { error: 'not_configured' });

    const { search, sources, tones = [] } = body;
    const urls = sources.flatMap((s) => (s.kind === 'web' && s.url ? [s.url] : []));
    const apiKey = process.env.PARALLEL_API_KEY;
    const canExtract = urls.length > 0 && (apiKey || devFlag('WEB_SEARCH_FAKE'));
    const pages = canExtract
      ? await extractPages(
          urls,
          search,
          { fetch: doFetch, apiKey: apiKey ?? 'local-fake' },
          { kind: body.kind, about: body.about },
        )
      : new Map<string, string | null>();

    const { candidates, unread } = toCandidates(sources, pages, search, body.kind);
    const { items: curated, dropped } = curateEvidence(
      candidates,
      search,
      body.kind && body.kind !== 'reference'
        ? candidates.map((candidate) => candidate.source)
        : body.retry?.preserveSources,
    );
    const early = [...unread, ...dropped];
    // Whole items are dropped, never cut, so no sentence loses its end.
    let total = 0;
    const items = curated.filter((item) => {
      if (
        total + item.text.length >
        (body.kind && body.kind !== 'reference'
          ? LIMITS.sources * LIMITS.itemChars
          : LIMITS.totalChars)
      ) {
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
    const cancel = () => controller.abort();
    request.signal.addEventListener('abort', cancel, { once: true });
    if (request.signal.aborted) cancel();
    const timer = setTimeout(() => controller.abort(), started + DEADLINE_MS - Date.now());
    const isTopic = body.kind !== undefined && body.kind !== 'reference';
    const promptVersion = isTopic ? TOPIC_PROMPT_VERSION : PROMPT_VERSION;
    let drafted;
    try {
      drafted = await draftWithFallback(
        providers,
        {
          prefix: isTopic ? TOPIC_PREFIX : PREFIX,
          promptVersion,
          user: requestText({
            search,
            about: body.about,
            evidence: items,
            tones,
            styleGuidance: body.styleGuidance,
            kind: body.kind,
            userContext: body.userContext,
            retry: body.retry,
          }),
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
      request.signal.removeEventListener('abort', cancel);
    }

    const checked = checkAnswer(drafted.answer, items, search, tones, body.kind);
    if (!checked.card) {
      const notUsed = firstPerSource(early);
      return json(422, { error: 'no_card', reason: checked.reason, notUsed });
    }
    const response: DraftResponse = {
      card:
        body.kind && body.kind !== 'reference' && early.length > 0
          ? { ...checked.card, partial: true }
          : checked.card,
      notUsed: firstPerSource([...early, ...checked.notUsed]),
      provider: drafted.provider,
      promptVersion,
    };
    return json(200, response);
  };
}

export const POST = withDraftStream(createDraftHandler());
