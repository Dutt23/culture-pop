// Throwaway trial: drafts a card per search per OpenAI model, checks it, writes report.html.
// Run: node --env-file=<project>/.env run.mjs   (reads OPENAI_API_KEY; never prints it)
import { readFileSync, writeFileSync } from 'node:fs';
import { PREFIX, PROMPT_VERSION, SCHEMA, request } from './prompt.mjs';
import { curateEvidence } from './curate.mjs';

const KEY = process.env.OPENAI_API_KEY;
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!KEY && !(CF_ACCOUNT && CF_TOKEN)) {
  console.error('Neither OPENAI_API_KEY nor CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN is set in .env');
  process.exit(1);
}

// OpenAI prices per 1M tokens (input, cached read, output), developers.openai.com/api/docs/pricing, 2026-11-18.
// Cloudflare: neurons per 1M tokens (input, -, output), developers.cloudflare.com/workers-ai/platform/pricing.
const ONLY = process.env.ONLY;
const ALL_MODELS = [
  ...(KEY
    ? [
        { provider: 'openai', id: 'gpt-6-luna', effort: 'none', maxOut: 800, price: [0.1, 0.01, 0.5] },
        { provider: 'openai', id: 'gpt-6.1-terra', effort: 'none', maxOut: 800, price: [1, 0.05, 5] },
        { provider: 'openai', id: 'gpt-6.2-sol', effort: 'low', maxOut: 1500, price: [2, 0.1, 10] },
      ]
    : []),
  ...(CF_ACCOUNT && CF_TOKEN
    ? [
        { provider: 'cloudflare', id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', maxOut: 800, neurons: [26668, 204805] },
        { provider: 'cloudflare', id: '@cf/openai/gpt-oss-120b', maxOut: 1500, neurons: [31818, 68182], extra: { reasoning: { effort: 'low' } } },
      ]
    : []),
];
const MODELS = ONLY ? ALL_MODELS.filter((m) => ONLY.split(',').some((o) => m.id.includes(o))) : ALL_MODELS;
const FREE_NEURONS_PER_DAY = 10_000;
const WRITE_MULTIPLIER = 1.25; // 30-minute cache write
const gathered = JSON.parse(readFileSync(new URL(`./${process.env.EVIDENCE ?? 'evidence.json'}`, import.meta.url), 'utf8'));
// Answer-key mode: every request gets the tone example, and no extra tone runs are added.
const TONE_ALL = process.env.TONE_ALL === '1';
// Two extra runs with a built-in card as the style card (from src/data/seedPackChainsmokers.ts).
const STYLE_SELFIE = {
  label: 'The joke song that made their name',
  gist: 'Their tongue-in-cheek breakout song, poking fun at club selfie culture.',
  means: "They're about to take a selfie, ironically.",
  reply: 'But first…',
  summary: 'Released free at the end of 2013 and re-released in 2014, it became their breakthrough.',
};
// The reader's search tags, as the app would send them.
const ABOUT = { ...(process.env.ABOUT ? JSON.parse(process.env.ABOUT) : {}), rizz: ['slang'], 'skibidi toilet': ['memes'], 'leap of faith assassins creed': ['games'], "here's johnny": ['film', 'tv'], 'beige flag': ['slang'] };
const searches = [
  ...gathered.map((g) => ({ ...g, about: ABOUT[g.q], ...(TONE_ALL && { style: STYLE_SELFIE }) })),
  ...gathered
    .filter((g) => !TONE_ALL && ['rizz', 'skibidi toilet'].includes(g.q))
    .map((g) => ({ ...g, about: ABOUT[g.q], style: STYLE_SELFIE, label: `${g.q} + style card` })),
].map((g) => {
  // Our curation runs first: labels, language and duplicate filters, order, caps.
  const { items, dropped } = curateEvidence(g.evidence, g.q);
  return { ...g, evidence: items, droppedByUs: dropped.map((d) => `${d.from}: ${d.why}`) };
});
const userText = (search) =>
  request({ style: search.style, search: search.q, about: search.about, evidence: search.evidence });

function body(model, search, temperature) {
  return {
    model: model.id,
    store: false,
    reasoning: { effort: model.effort },
    max_output_tokens: model.maxOut,
    ...(temperature !== undefined && { temperature }),
    prompt_cache_options: { mode: 'explicit', ttl: '30m' },
    prompt_cache_key: PROMPT_VERSION,
    text: { format: { type: 'json_schema', name: 'card', schema: SCHEMA, strict: true } },
    input: [
      {
        role: 'developer',
        content: [
          {
            type: 'input_text',
            text: PREFIX,
            prompt_cache_breakpoint: { mode: 'explicit' },
          },
        ],
      },
      { role: 'user', content: [{ type: 'input_text', text: userText(search) }] },
    ],
  };
}

// Cloudflare's own endpoint with JSON mode (no caching there). Answers in the shape used below.
async function callCloudflare(model, search) {
  const started = Date.now();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${model.id}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CF_TOKEN}` },
      body: JSON.stringify({
        max_tokens: model.maxOut,
        ...model.extra,
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        messages: [
          { role: 'system', content: PREFIX },
          { role: 'user', content: userText(search) },
        ],
      }),
    },
  );
  const json = await response.json();
  const result = json.result ?? {};
  // Llama answers in `response`; gpt-oss answers in OpenAI's chat shape.
  const raw = result.response ?? result.choices?.[0]?.message?.content ?? null;
  const answer = typeof raw === 'string' ? raw : JSON.stringify(raw);
  return {
    ok: response.ok && json.success !== false,
    status: response.status,
    ms: Date.now() - started,
    json: {
      error: json.errors?.length ? { message: json.errors.map((e) => e.message).join('; ') } : undefined,
      output: [{ content: [{ type: 'output_text', text: answer }] }],
      usage: {
        input_tokens: result.usage?.prompt_tokens,
        output_tokens: result.usage?.completion_tokens,
        neurons: result.usage?.neurons,
        cached: result.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      },
    },
  };
}

async function call(model, search, temperature) {
  if (model.provider === 'cloudflare') return callCloudflare(model, search);
  const started = Date.now();
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body(model, search, temperature)),
  });
  const json = await response.json();
  return { ok: response.ok, status: response.status, json, ms: Date.now() - started };
}

const outputText = (json) =>
  (json.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text)
    .join('');

// --- Checks (a simple stand-in for the app's check.ts) ---
const STOP = new Set('a an and are as at be by for from has have in is it its of on or that the this to was were with who what when which their they he she his her not but also into than then there'.split(' '));
const words = (text) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
const content = (text) => words(text).filter((w) => w.length > 2 && !STOP.has(w));
const namesAndNumbers = (text) =>
  [...text.matchAll(/\b(?:[A-Z][\p{L}'-]+|\d[\d.,]*)\b/gu)].map((m) => m[0]).filter((w, i) => i > 0 || /\d/.test(w));

const norm = (text) => text.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const bareName = (name) => norm(name).replace(/'s$/, '');
/** The search's leading words, longest first ("leap of faith assassins creed" … "leap of faith"). */
function searchForms(q) {
  const words = norm(q).split(' ');
  return words.map((_, i) => words.slice(0, words.length - i).join(' ')).filter((f) => f.length >= 4);
}
/** True when a line shares 4 words in a row with the tone example. */
function copiesTone(text, style) {
  if (!style) return false;
  const grams = (s) => { const w = words(s); return new Set(w.map((_, i) => w.slice(i, i + 4).join(' ')).filter((g) => g.split(' ').length === 4)); };
  const toneGrams = new Set(Object.values(style).flatMap((v) => [...grams(String(v))]));
  const mine = grams(text);
  return [...mine].some((g) => toneGrams.has(g)) || norm(text).replace(/[^a-z ]/g, '').trim() === norm(style.reply).replace(/[^a-z ]/g, '').trim();
}

function grounded(text, ids, byId) {
  const cited = ids.map((id) => byId.get(id)).filter(Boolean);
  if (cited.length !== ids.length || cited.length === 0) return 'unknown source';
  const source = cited.map((e) => e.text).join(' ').toLowerCase();
  const missingNames = namesAndNumbers(text).filter((n) => !source.includes(bareName(n)));
  if (missingNames.length) return `not in source: ${missingNames.join(', ')}`;
  const cw = content(text);
  const hit = cw.filter((w) => source.includes(w)).length;
  return cw.length === 0 || hit / cw.length >= 0.6 ? null : `only ${Math.round((100 * hit) / cw.length)}% of words in source`;
}

/** Replies that would fit any reference: banned by the prompt, flagged here. */
const GENERIC_REPLY = /^(nice( one)?|good luck( with that)?|fair (point|enough)|got it|cool|classic|same|sounds (wild|good|fun)|oh,? (nice|cool)|haha|lol|bring it on|nice move)[.!? ,]*(i guess|indeed|noted)?[.!?]*$/i;

function check(card, search) {
  const style = search.style;
  const byId = new Map(search.evidence.map((e) => [e.id, e]));
  const all = search.evidence.map((e) => e.text).join(' ').toLowerCase();
  const sentences = [
    ...card.summary.map((s) => ({ part: 'summary', ...s })),
    ...card.context.map((s) => ({ part: 'context', ...s })),
  ].map((s) => ({ ...s, problem: grounded(s.t, s.ids, byId) }));
  let example = null;
  if (card.example) {
    const line = norm(card.example.t).replace(/[.!?]$/, '');
    const inItem = card.example.ids.some((id) => byId.get(id) && norm(byId.get(id).text).includes(line));
    const showsIt = searchForms(search.q).some((f) => line.includes(f));
    example = { ...card.example, problem: !inItem ? 'not copied word for word' : !showsIt ? "doesn't contain the search" : null };
  }
  // gist / means / reply cite nothing, so they may not bring in a name or number the results lack.
  const free = ['gist', 'means', 'reply'].map((part) => {
    const missing = namesAndNumbers(card[part]).filter((n) => !norm(all).includes(bareName(n)));
    const copied = copiesTone(card[part], style);
    const generic = part === 'reply' && !card.unclear && GENERIC_REPLY.test(card.reply.trim());
    return {
      part,
      t: card[part],
      problem: copied ? 'copied from the tone example' : missing.length ? `not in results: ${missing.join(', ')}` : generic ? 'generic reply' : null,
    };
  });
  return { sentences, example, free };
}

function cost(model, usage) {
  if (model.provider === 'cloudflare') return 0; // inside the free daily allowance; see neurons below
  const d = usage?.input_tokens_details ?? {};
  const cached = d.cached_tokens ?? 0;
  const written = d.cache_write_tokens ?? 0;
  const plain = (usage?.input_tokens ?? 0) - cached - written;
  const [inP, cacheP, outP] = model.price;
  return (plain * inP + written * inP * WRITE_MULTIPLIER + cached * cacheP + (usage?.output_tokens ?? 0) * outP) / 1e6;
}

// --- Run ---
const rows = [];
let temperatureNote = {};
for (const model of MODELS) {
  for (const [index, search] of searches.entries()) {
    // Try temperature 0.2 once per model with thinking off; keep the result either way.
    let temperature = index === 0 && model.provider === 'openai' && model.effort === 'none' ? 0.2 : undefined;
    let result = await call(model, search, temperature);
    if (temperature !== undefined) {
      temperatureNote[model.id] = result.ok ? 'accepted 0.2' : `rejected (${result.json?.error?.message ?? result.status})`;
      if (!result.ok) result = await call(model, search, undefined);
    }
    const row = { model: model.id, q: search.label ?? search.q, ms: result.ms, usage: result.json.usage, status: result.json.status };
    if (!result.ok) {
      row.error = result.json?.error?.message ?? `HTTP ${result.status}`;
    } else {
      try {
        row.card = JSON.parse(outputText(result.json));
        row.checks = check(row.card, search);
      } catch (error) {
        row.error = `unreadable answer (${result.json.status}): ${error.message}`;
      }
    }
    row.cost = cost(model, result.json.usage);
    const u = result.json.usage ?? {};
    if (model.neurons) {
      row.neurons = u.neurons ? Math.round(u.neurons) : Math.round(((u.input_tokens ?? 0) * model.neurons[0] + (u.output_tokens ?? 0) * model.neurons[1]) / 1e6);
      row.freeCardsPerDay = row.neurons ? Math.floor(FREE_NEURONS_PER_DAY / row.neurons) : null;
    }
    rows.push(row);
    console.log(`${model.id} | ${search.q} | ${row.error ? 'ERROR ' + row.error : 'ok'} | ${result.ms} ms | in ${u.input_tokens} (cached ${u.input_tokens_details?.cached_tokens ?? 0}, written ${u.input_tokens_details?.cache_write_tokens ?? 0}) out ${u.output_tokens} | $${row.cost.toFixed(5)}${row.neurons ? ` | ${row.neurons} neurons (~${row.freeCardsPerDay} free/day)` : ''}`);
  }
}
// A partial run (ONLY=…) replaces just that model's rows in the saved results.
const resultsUrl = new URL(`./${process.env.RESULTS ?? 'results.json'}`, import.meta.url);
let saved = { rows: [], temperatureNote: {} };
try { saved = JSON.parse(readFileSync(resultsUrl, 'utf8')); } catch {}
const ran = new Set(MODELS.map((m) => m.id));
const merged = ONLY ? [...saved.rows.filter((r) => !ran.has(r.model)), ...rows] : rows;
writeFileSync(resultsUrl, JSON.stringify({ rows: merged, temperatureNote: { ...saved.temperatureNote, ...temperatureNote }, searches }, null, 2));
console.log('temperature:', temperatureNote);
console.log('total $', rows.reduce((s, r) => s + r.cost, 0).toFixed(4));
