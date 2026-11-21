/**
 * Before/after card drafts for "Found online" picks, through the real /api/draft-card handler.
 * Before: the two-sentence text the app sends today (Wikipedia blocked) and topic-card-v1.
 * After: Wikipedia intros and topic-card-v2.
 * Paid: 2 OpenAI calls per case. Stops before a call once the token budget is spent.
 * Run with the key loaded from .env (never printed):
 *   node --env-file=.env node_modules/vitest/vitest.mjs run --config scripts/card-drafts/vitest.config.ts
 */
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { createDraftHandler } from '../../api/draft-card.js';
import { openAiProvider, type DraftProvider } from '../../api/_lib/cardProviders.js';
import { TOPIC_PREFIX as BEFORE_PREFIX } from './cardPrompt.before.js';

/** AFTER_ONLY=1 re-drafts only the "after" cards; BUDGET_USD lowers the cap (e.g. what is left). */
const AFTER_ONLY = process.env.AFTER_ONLY === '1';
const OUT = `scripts/card-drafts/out/compare${AFTER_ONLY ? '-after' : ''}${process.env.RUN ? `-${process.env.RUN}` : ''}.json`;
/**
 * Conservative ceiling for $0.50: priced as if $5 per 1M input and $20 per 1M output tokens,
 * far above small-model prices.
 */
const BUDGET_USD = Number(process.env.BUDGET_USD ?? 0.5);
const PRICE_IN = 5 / 1e6;
const PRICE_OUT = 20 / 1e6;
/** One call's worst case: a long prompt plus the full topic output cap. */
const WORST_CALL_USD = 8000 * PRICE_IN + 1600 * PRICE_OUT;

/** What the app sends today for a Wikipedia hit: its first two sentences (fetched 2026-11-22). */
const wiki = (title: string, text: string) => ({ kind: 'wiki', from: 'wikipedia', title, text });
const CASES = [
  {
    search: 'gundam',
    sources: [
      wiki(
        'Mobile Suit Gundam',
        'Mobile Suit Gundam (Japanese: 機動戦士ガンダム, Hepburn: Kidō Senshi Gandamu) is a Japanese anime television series produced by Nippon Sunrise. Co-created and directed by Yoshiyuki Tomino, it premiered in Japan on Nagoya Broadcasting Network and its affiliated ANN stations on April 7, 1979, airing 43 episodes until its cancellation on January 26, 1980.',
      ),
      wiki(
        'Mobile Suit Gundam SEED',
        'Mobile Suit Gundam SEED (Japanese: 機動戦士ガンダムSEED(シード), Hepburn: Kidō Senshi Gandamu Shīdo) is a 2002 Japanese anime television series developed by Sunrise and directed by Mitsuo Fukuda. The ninth installment in the Gundam franchise, Gundam SEED takes place in a future calendar era, in this case the Cosmic Era.',
      ),
      wiki(
        'Mobile Suit Gundam Wing',
        "Mobile Suit Gundam Wing (Japanese: 新機動戦記ガンダムW(ウイング), Hepburn: Shin Kidō Senki Gandamu Uingu; lit. 'New Mobile Report Gundam Wing'), is a 1995 Japanese mecha anime series directed by Masashi Ikeda and written by Katsuyuki Sumizawa. It is the sixth installment in the Gundam franchise, taking place in the \"After Colony\" timeline.",
      ),
    ],
  },
  {
    search: 'evangelion',
    sources: [
      wiki(
        'Neon Genesis Evangelion',
        "Neon Genesis Evangelion (Japanese: 新世紀エヴァンゲリオン, Hepburn: Shin Seiki Evangerion; lit. 'New Century Evangelion' in Japanese and lit. 'New Beginning Gospel' in Greek), also known as simply Evangelion or Eva, is a Japanese anime television series produced by Gainax and Tatsunoko Production, and directed by Hideaki Anno. It was broadcast on TV Tokyo and its affiliates from October 1995 to March 1996.",
      ),
      wiki(
        'The End of Evangelion',
        'The End of Evangelion is a 1997 Japanese animated apocalyptic science fiction film directed by Hideaki Anno and Kazuya Tsurumaki, written by Anno, and animated by Gainax and Production I.G. It serves as an ending to the anime television series Neon Genesis Evangelion, which aired from 1995 to 1996.',
      ),
    ],
  },
  {
    search: 'miyazaki films',
    sources: [
      wiki(
        'Spirited Away',
        'Spirited Away is a 2001 Japanese animated fantasy film written and directed by Hayao Miyazaki. It was produced by Toshio Suzuki, animated by Studio Ghibli, and distributed by Toho.',
      ),
      wiki(
        'My Neighbor Totoro',
        'My Neighbor Totoro is a 1988 Japanese animated fantasy film written and directed by Hayao Miyazaki and animated by Studio Ghibli for Tokuma Shoten. It stars the voices of Noriko Hidaka, Chika Sakamoto and Hitoshi Takagi, and focuses on two young sisters who, after moving with their father to the countryside, experience interactions with friendly wood spirits in postwar Japan.',
      ),
    ],
  },
];

/** More cases; their "before" text (the first two sentences) is fetched free from Wikipedia. */
const MORE: { search: string; titles: string[] }[] = [
  { search: 'star wars', titles: ['Star Wars (film)', 'The Empire Strikes Back'] },
  { search: 'breaking bad', titles: ['Breaking Bad', 'Better Call Saul'] },
  { search: 'the office', titles: ['The Office (American TV series)', 'The Office (British TV series)'] },
  { search: 'pokemon', titles: ['Pokémon (TV series)', 'Pokémon Red and Blue'] },
  { search: 'marvel avengers', titles: ['Iron Man (2008 film)', 'The Avengers (2012 film)'] },
];

async function twoSentences(titles: string[]): Promise<ReturnType<typeof wiki>[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
    exlimit: '20',
    redirects: '1',
    titles: titles.join('|'),
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'PopCultureDecoder/0.2 (https://culture-pop.vercel.app)' },
  });
  const pages = ((await response.json()) as { query: { pages: { title: string; extract?: string }[] } })
    .query.pages;
  return pages.flatMap((p) => (p.extract ? [wiki(p.title, p.extract)] : []));
}

/** Gist/takeaway phrases the owner complained about. */
const META =
  /\b(?:the|these|this|those) (?:evidence|sources?|passages?|results|entries|items)\b|little detail|limited (?:\w+ )?(?:detail|context|information|overview)|partial overview/i;

it('drafts every case before and after', async () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set (run with --env-file=.env)');
  let spent = 0;
  let stopped = false;
  let calls = 0;
  const tokens = { input: 0, output: 0 };

  // Counts real usage from each OpenAI answer; refuses a call that could pass the budget.
  const metered: typeof fetch = async (url, init) => {
    if (String(url).startsWith('https://api.openai.com/')) {
      if (spent + WORST_CALL_USD > BUDGET_USD) {
        stopped = true;
        throw new Error('budget reached');
      }
      const response = await fetch(url, init);
      const usage = ((await response.clone().json()) as { usage?: Record<string, number> }).usage;
      tokens.input += usage?.input_tokens ?? 0;
      tokens.output += usage?.output_tokens ?? 0;
      spent = tokens.input * PRICE_IN + tokens.output * PRICE_OUT;
      calls += 1;
      return response;
    }
    return fetch(url, init);
  };
  const noWikipedia: typeof fetch = (url, init) =>
    String(url).startsWith('https://en.wikipedia.org/')
      ? Promise.resolve(new Response('blocked for the before run', { status: 503 }))
      : metered(url, init);

  const openai = openAiProvider({ fetch: metered, apiKey, model: process.env.OPENAI_MODEL });
  const recording = (raw: unknown[], prefix?: string): DraftProvider => ({
    name: 'openai',
    draft: async (input, signal) => {
      const answer = await openai.draft(
        prefix ? { ...input, prefix, promptVersion: 'topic-card-v1' } : input,
        signal,
      );
      raw.push(answer);
      return answer;
    },
  });

  const only = process.env.ONLY?.split(',');
  const all = [
    ...CASES,
    ...(await Promise.all(MORE.map(async (m) => ({ search: m.search, sources: await twoSentences(m.titles) })))),
  ].filter((c) => !only || only.includes(c.search));
  const results = [];
  for (const c of all) {
    const run = async (label: string, doFetch: typeof fetch, prefix?: string) => {
      const raw: unknown[] = [];
      const handle = createDraftHandler({
        fetch: doFetch,
        checkAccess: () => 'ok',
        providers: [recording(raw, prefix)],
      });
      const request = new Request('https://local.test/api/draft-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: c.search, kind: 'topic', sources: c.sources }),
      });
      const response = await handle(request);
      const body = (await response.json()) as {
        card?: { gist: string; means: string; summary: { text: string }[]; context: { text: string }[] };
        notUsed?: unknown[];
      };
      const answer = raw[0] as { gist?: string; means?: string } | undefined;
      const lines = [...(body.card?.summary ?? []), ...(body.card?.context ?? [])];
      const score = {
        card: response.status === 200,
        aiWroteMeta: META.test(`${answer?.gist ?? ''} ${answer?.means ?? ''}`),
        sourcesUsed: `${c.sources.length - (body.notUsed?.length ?? 0)}/${c.sources.length}`,
        lines: lines.length,
        chars: lines.reduce((n, l) => n + l.text.length, 0),
      };
      return { label, status: response.status, score, card: body, raw: raw[0] };
    };
    results.push({
      search: c.search,
      ...(AFTER_ONLY ? {} : { before: await run('before', noWikipedia, BEFORE_PREFIX) }),
      after: await run('after', metered),
    });
    const scores = (k: string, v: unknown) => (k === 'card' || k === 'raw' ? undefined : v);
    console.info(c.search, JSON.stringify(results.at(-1), scores));
    if (stopped) break;
  }
  writeFileSync(OUT, JSON.stringify({ calls, tokens, estimateUsdCeiling: spent, stopped, results }, null, 2));
  console.info(`calls=${calls} tokens=${JSON.stringify(tokens)} ceiling=$${spent.toFixed(3)}`);
});
