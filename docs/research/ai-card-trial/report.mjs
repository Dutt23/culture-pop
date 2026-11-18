// Throwaway: turns results.json into report.html (drafts side by side, failed checks struck through).
import { readFileSync, writeFileSync } from 'node:fs';

const { rows, temperatureNote, searches } = JSON.parse(readFileSync(new URL('./results.json', import.meta.url), 'utf8'));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const models = [...new Set(rows.map((r) => r.model))];
const short = (m) => m.replace('@cf/meta/', '').replace('@cf/openai/', 'cf/').replace('-instruct-fp8-fast', '');

function line(label, s) {
  if (!s) return '';
  const bad = s.problem ? ` class="bad" title="${esc(s.problem)}"` : '';
  const ids = s.ids ? ` <span class="ids">${esc(s.ids.join(' '))}</span>` : '';
  const why = s.problem ? ` <span class="why">${esc(s.problem)}</span>` : '';
  return `<p><b>${label}</b> <span${bad}>${esc(s.t)}</span>${ids}${why}</p>`;
}

function card(row) {
  const meta = `${(row.ms / 1000).toFixed(1)} s · ${row.neurons ? `${row.neurons} neurons (~${row.freeCardsPerDay}/day free)` : `$${row.cost.toFixed(4)}`}${
    row.usage?.input_tokens_details ? ` · cache read ${row.usage.input_tokens_details.cached_tokens ?? 0}, written ${row.usage.input_tokens_details.cache_write_tokens ?? 0}` : ''
  }`;
  if (row.error) return `<div class="card err"><h4>${esc(short(row.model))}</h4><p>${esc(row.error)}</p><p class="meta">${meta}</p></div>`;
  const c = row.card;
  const k = row.checks;
  const free = Object.fromEntries(k.free.map((f) => [f.part, f]));
  const flags = [c.unclear && '<span class="tag">unclear</span>', c.spoiler === 'major' && '<span class="tag sp">spoiler</span>'].filter(Boolean).join(' ');
  return `<div class="card"><h4>${esc(short(row.model))} ${flags}</h4>
    <p class="label">${esc(c.label)}</p>
    ${line('Gist', free.gist)}${line('Means', free.means)}${line('Reply', free.reply)}
    ${k.sentences.map((s) => line(s.part === 'summary' ? 'Summary' : 'Context', s)).join('')}
    ${line('Example', k.example)}
    <p class="meta">${meta}</p></div>`;
}

const totals = models.map((m) => {
  const mine = rows.filter((r) => r.model === m);
  const ok = mine.filter((r) => !r.error);
  const dropped = ok.reduce((n, r) => n + r.checks.sentences.filter((s) => s.problem).length + r.checks.free.filter((f) => f.problem).length + (r.checks.example?.problem ? 1 : 0), 0);
  const kept = ok.reduce((n, r) => n + r.checks.sentences.filter((s) => !s.problem).length, 0);
  const avg = mine.reduce((s, r) => s + r.ms, 0) / mine.length / 1000;
  const cost = mine.reduce((s, r) => s + r.cost, 0);
  const neurons = mine.filter((r) => r.neurons).map((r) => r.neurons);
  const cacheReads = mine.filter((r) => (r.usage?.input_tokens_details?.cached_tokens ?? 0) > 0).length;
  return `<tr><td>${esc(short(m))}</td><td>${ok.length}/${mine.length}</td><td>${kept}</td><td>${dropped}</td><td>${avg.toFixed(1)} s</td><td>${
    neurons.length ? `${Math.round(neurons.reduce((a, b) => a + b, 0) / neurons.length)} neurons/card` : `$${cost.toFixed(4)} (${cacheReads}/${mine.length} cached)`
  }</td></tr>`;
});

const sections = [...new Set(rows.map((r) => r.q))].map((q) => {
  const base = searches.find((s) => s.q === q.replace(' + style card', ''));
  const evidence = base.evidence
    .map((e) => `<li><b>${e.id}</b> <span class="from">${esc(e.from)}</span> ${esc(e.title)}: <span class="ev">${esc(e.text.slice(0, 260))}${e.text.length > 260 ? '…' : ''}</span></li>`)
    .join('');
  return `<section><h2>${esc(q)}</h2><details><summary>Evidence sent (${base.evidence.length} items, ${base.chars} characters)</summary><ul>${evidence}</ul></details>
    <div class="grid">${rows.filter((r) => r.q === q).map(card).join('')}</div></section>`;
});

writeFileSync(
  new URL('./report.html', import.meta.url),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AI card draft trial</title>
<style>
:root{--bg:#fbf8f3;--fg:#1b1630;--muted:#5d566f;--card:#fff;--line:#e3dbcf;--bad:#b3261e;--tag:#efe7ff}
@media (prefers-color-scheme:dark){:root{--bg:#0d0b1f;--fg:#ece8ff;--muted:#b6aed6;--card:#18153a;--line:#2d2758;--bad:#ff8a80;--tag:#2d2758}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;margin:0;padding:16px;max-width:1400px;margin-inline:auto}
h1{font-size:22px}h2{font-size:18px;margin-top:32px}h4{margin:0 0 6px;font-size:14px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.card p{margin:4px 0}
.card.err{border-color:var(--bad)}.label{font-weight:600}
.bad{text-decoration:line-through;color:var(--bad)}.why{color:var(--bad);font-size:12px}
.ids,.from,.meta{color:var(--muted);font-size:12px}.ev{color:var(--muted)}
.tag{background:var(--tag);border-radius:6px;padding:1px 6px;font-size:12px;font-weight:400}.sp{color:var(--bad)}
details{margin-bottom:10px}li{margin:3px 0}
</style></head><body>
<h1>AI card draft trial</h1>
<p>Same prompt (card-draft-v1) for every model. Struck-through lines are what the server checks would drop; hover for the reason. Temperature: ${esc(JSON.stringify(temperatureNote))}.</p>
<table><tr><th>Model</th><th>Answered</th><th>Sentences kept</th><th>Lines dropped</th><th>Avg time</th><th>Cost</th></tr>${totals.join('')}</table>
${sections.join('')}
</body></html>`,
);
console.log('report.html written');
