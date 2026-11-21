/**
 * The server's tunable settings in one place. Each has a default (today's value) and an optional
 * env override, read once when the module loads. A bad override (not a whole number, outside its
 * bounds, a non-https URL, an odd model name) is ignored with a one-line warning that names the
 * variable but never prints its value; the default is used instead. Size caps that protect the
 * server stay bounded, so no env value can make them unlimited. Secrets (API keys, SUPABASE_*) are
 * read where they are used, not here.
 *
 * | Env var                          | Default                                       | Allowed           |
 * | -------------------------------- | --------------------------------------------- | ----------------- |
 * | PCD_WIKI_URL                     | https://en.wikipedia.org/w/api.php            | https URL         |
 * | PCD_WIKI_USER_AGENT              | PopCultureDecoder/0.2 (https://culture-pop.vercel.app) | 1–200 plain chars |
 * | PCD_WIKI_MAX_BYTES               | 524288 (512 KB)                               | 16 KB – 2 MB      |
 * | PCD_WIKI_TIMEOUT_MS              | 4000                                          | 500 – 15000       |
 * | PCD_WIKI_MAX_TITLES              | 20                                            | 1 – 20            |
 * | PCD_EXTRACT_URL                  | https://api.parallel.ai/v1/extract            | https URL         |
 * | PCD_EXTRACT_MAX_BYTES            | 262144 (256 KB)                               | 16 KB – 2 MB      |
 * | PCD_EXTRACT_TIMEOUT_MS           | 10000                                         | 1000 – 20000      |
 * | PCD_EXTRACT_MAX_SENTENCE_CHARS   | 400                                           | 100 – 2000        |
 * | PCD_OPENAI_URL                   | https://api.openai.com/v1/responses           | https URL         |
 * | OPENAI_MODEL (*)                 | gpt-6-luna                                    | model id          |
 * | CLOUDFLARE_MODEL (*)             | @cf/meta/llama-3.3-70b-instruct-fp8-fast      | model id          |
 * | PCD_MAX_OUTPUT_TOKENS            | 800                                           | 100 – 4000        |
 * | PCD_MAX_TOPIC_OUTPUT_TOKENS      | 1600                                          | 100 – 4000        |
 * | PCD_PROVIDER_MAX_BYTES           | 262144 (256 KB)                               | 16 KB – 2 MB      |
 * | PCD_FALLBACK_AFTER_MS            | 11000                                         | 1000 – 22000      |
 * | PCD_SEARCH_URL                   | https://api.parallel.ai/v1/search             | https URL         |
 * | PCD_SEARCH_MAX_RESULTS           | 10                                            | 1 – 20            |
 * | PCD_SEARCH_MAX_TITLE             | 120                                           | 20 – 500          |
 * | PCD_SEARCH_MAX_SNIPPET           | 300                                           | 50 – 2000         |
 * | PCD_SEARCH_MAX_EXCERPT           | 4000                                          | 500 – 20000       |
 * | PCD_SEARCH_MAX_URL               | 2048                                          | 256 – 8192        |
 * | PCD_SEARCH_MAX_UPSTREAM_BYTES    | 262144 (256 KB)                               | 16 KB – 2 MB      |
 * | PCD_SEARCH_MAX_REQUEST_BYTES     | 2048                                          | 512 – 16384       |
 * | PCD_SEARCH_MAX_RESPONSE_BYTES    | 16384 (16 KB)                                 | 4 KB – 256 KB     |
 * | PCD_SEARCH_TIMEOUT_MS            | 8000                                          | 1000 – 20000      |
 * | PCD_DRAFT_MAX_REQUEST_BYTES      | 81920 (80 KB)                                 | 16 KB – 256 KB    |
 * | PCD_DRAFT_MAX_TITLE              | 200                                           | 20 – 1000         |
 * | PCD_DRAFT_MIN_SNIPPET            | 40                                            | 0 – 400           |
 * | PCD_DRAFT_DEADLINE_MS            | 23000                                         | 5000 – 24000      |
 * | PCD_SUPABASE_TIMEOUT_MS          | 10000                                         | 1000 – 20000      |
 *
 * (*) Keep their existing names so deployed settings still work. They are read with `readModel` by
 * `providersFromEnv` (cardProviders.ts), which takes the env per request; the defaults live here.
 * URL overrides receive the matching API key, so only point them at a service you trust.
 */

type Env = Readonly<Record<string, string | undefined>>;
type Warn = (message: string) => void;

const KB = 1024;
const MB = 1024 * KB;
/** Model ids such as `gpt-6-luna` or `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. */
const MODEL_ID = /^[\w@./:-]{1,100}$/;
/** Printable ASCII only, so a header value can't carry a line break. */
const HEADER_TEXT = /^[\x20-\x7e]{1,200}$/;

const ignored = (warn: Warn, name: string, why: string) =>
  warn(`[config] ${name} ignored (${why}); using the default.`);

/** A whole number within [min, max] from `env[name]`, or `fallback`. */
export function readInt(
  env: Env,
  name: string,
  fallback: number,
  min: number,
  max: number,
  warn: Warn,
): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(value)) {
    ignored(warn, name, 'not a whole number');
    return fallback;
  }
  if (value < min || value > max) {
    ignored(warn, name, `outside ${min}–${max}`);
    return fallback;
  }
  return value;
}

/** An https URL without credentials from `env[name]`, or `fallback`. */
export function readUrl(env: Env, name: string, fallback: string, warn: Warn): string {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {
    // Falls through to the warning.
  }
  ignored(warn, name, 'not an https URL');
  return fallback;
}

/** A model id from `env[name]`, or undefined when unset or malformed (then the default is used). */
export function readModel(env: Env, name: string, warn: Warn = console.warn): string | undefined {
  return readText(env, name, '', MODEL_ID, warn) || undefined;
}

/** Text matching `pattern` from `env[name]`, or `fallback`. */
function readText(env: Env, name: string, fallback: string, pattern: RegExp, warn: Warn): string {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  if (pattern.test(raw)) return raw;
  ignored(warn, name, 'unexpected characters or length');
  return fallback;
}

export function loadConfig(env: Env = process.env, warn: Warn = console.warn) {
  const int = (name: string, fallback: number, min: number, max: number) =>
    readInt(env, name, fallback, min, max, warn);
  const url = (name: string, fallback: string) => readUrl(env, name, fallback, warn);
  return {
    wiki: {
      url: url('PCD_WIKI_URL', 'https://en.wikipedia.org/w/api.php'),
      /** Wikimedia asks API clients to identify themselves. */
      userAgent: readText(
        env,
        'PCD_WIKI_USER_AGENT',
        'PopCultureDecoder/0.2 (https://culture-pop.vercel.app)',
        HEADER_TEXT,
        warn,
      ),
      /** Ten article intros are well under this; anything bigger is refused unread. */
      maxBytes: int('PCD_WIKI_MAX_BYTES', 512 * KB, 16 * KB, 2 * MB),
      timeoutMs: int('PCD_WIKI_TIMEOUT_MS', 4_000, 500, 15_000),
      /** Wikipedia's per-request cap for intro extracts. */
      maxTitles: int('PCD_WIKI_MAX_TITLES', 20, 1, 20),
    },
    extract: {
      url: url('PCD_EXTRACT_URL', 'https://api.parallel.ai/v1/extract'),
      /** Parallel's answers are small; anything bigger is refused unread. */
      maxBytes: int('PCD_EXTRACT_MAX_BYTES', 256 * KB, 16 * KB, 2 * MB),
      timeoutMs: int('PCD_EXTRACT_TIMEOUT_MS', 10_000, 1_000, 20_000),
      /** Longer "sentences" are page menus run together, not prose. */
      maxSentenceChars: int('PCD_EXTRACT_MAX_SENTENCE_CHARS', 400, 100, 2_000),
    },
    providers: {
      openAiUrl: url('PCD_OPENAI_URL', 'https://api.openai.com/v1/responses'),
      /** Overridden per request by OPENAI_MODEL / CLOUDFLARE_MODEL (see `readModel`). */
      openAiModel: 'gpt-6-luna',
      cloudflareModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      maxOutputTokens: int('PCD_MAX_OUTPUT_TOKENS', 800, 100, 4_000),
      /** Topic cards write longer answers; both providers get the same cap. */
      maxTopicOutputTokens: int('PCD_MAX_TOPIC_OUTPUT_TOKENS', 1_600, 100, 4_000),
      maxBytes: int('PCD_PROVIDER_MAX_BYTES', 256 * KB, 16 * KB, 2 * MB),
      /** Each provider but the last gets at most this long, so a hanging one leaves time. */
      fallbackAfterMs: int('PCD_FALLBACK_AFTER_MS', 11_000, 1_000, 22_000),
    },
    search: {
      url: url('PCD_SEARCH_URL', 'https://api.parallel.ai/v1/search'),
      maxResults: int('PCD_SEARCH_MAX_RESULTS', 10, 1, 20),
      maxTitle: int('PCD_SEARCH_MAX_TITLE', 120, 20, 500),
      maxSnippet: int('PCD_SEARCH_MAX_SNIPPET', 300, 50, 2_000),
      /** Each excerpt is cut before cleaning, so a hostile page can't make the regex work slow. */
      maxExcerpt: int('PCD_SEARCH_MAX_EXCERPT', 4_000, 500, 20_000),
      maxUrl: int('PCD_SEARCH_MAX_URL', 2_048, 256, 8_192),
      /** Parallel's answers are a few KB; anything bigger is refused unread. */
      maxUpstreamBytes: int('PCD_SEARCH_MAX_UPSTREAM_BYTES', 256 * KB, 16 * KB, 2 * MB),
      /**
       * `{ "q": "…", "question": true, "videos": true, "about": […] }` with a 200-character query
       * and five 30-character tags fits, even in four-byte characters; anything bigger is refused.
       */
      maxRequestBytes: int('PCD_SEARCH_MAX_REQUEST_BYTES', 2_048, 512, 16 * KB),
      /** What we send the phone stays small; results are dropped from the end until it fits. */
      maxResponseBytes: int('PCD_SEARCH_MAX_RESPONSE_BYTES', 16 * KB, 4 * KB, 256 * KB),
      timeoutMs: int('PCD_SEARCH_TIMEOUT_MS', 8_000, 1_000, 20_000),
    },
    draft: {
      /** Accommodates ten bounded sources, titles, URLs and tones, including 4-byte text. */
      maxRequestBytes: int('PCD_DRAFT_MAX_REQUEST_BYTES', 80 * KB, 16 * KB, 256 * KB),
      maxTitle: int('PCD_DRAFT_MAX_TITLE', 200, 20, 1_000),
      minSnippet: int('PCD_DRAFT_MIN_SNIPPET', 40, 0, 400),
      /** From the request's start: under the app's 25 s wait, so the reader gets our answer. */
      deadlineMs: int('PCD_DRAFT_DEADLINE_MS', 23_000, 5_000, 24_000),
    },
    supabase: {
      timeoutMs: int('PCD_SUPABASE_TIMEOUT_MS', 10_000, 1_000, 20_000),
    },
  };
}

export type Config = ReturnType<typeof loadConfig>;

/** Read once per server instance. */
export const CONFIG: Config = loadConfig();
