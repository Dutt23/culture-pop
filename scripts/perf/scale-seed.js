/* eslint-disable */
// Used by scale-bench.mjs. Runs INSIDE the app's origin (page.evaluate): fills the app's IndexedDB
// with fake, realistic rows through the raw IndexedDB API, so it works against the production
// bundle with no app imports. Deterministic: the same N always gives the same rows. Nothing leaves
// the browser. Usage from Playwright:
//   await page.evaluate(`${source}; seed(${JSON.stringify({ n })})`)

async function seed(plan) {
  const DB = 'pop-culture-decoder';
  let s = 12345;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const SYL = [
    'ka',
    'zu',
    'mo',
    'ri',
    'ten',
    'sha',
    'bel',
    'dor',
    'vin',
    'qua',
    'lo',
    'pex',
    'nar',
    'ti',
    'gum',
    'fro',
    'yel',
    'ox',
    'brim',
    'sol',
    'and',
    'the',
    'ul',
    'mi',
    'ra',
    'sto',
    'pli',
    'vek',
    'jo',
    'ze',
  ];
  const word = () => Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(SYL)).join('');
  const phrase = (n) => Array.from({ length: n }, word).join(' ');
  const CATS = ['film', 'tv', 'music', 'internet', 'games', 'books', 'anime', 'sport'];
  const KINDS = ['work', 'quote', 'phrase', 'meme', 'character', 'other'];
  const DECADES = ['1990s', '2000s', '2010s+'];
  const t0 = Date.parse('2026-01-01T00:00:00Z');
  const iso = (i) => new Date(t0 + i * 60_000).toISOString();

  const open = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open(DB);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  const db = await open();

  async function fill(store, count, make, chunk = 5000) {
    const t = performance.now();
    for (let start = 0; start < count; start += chunk) {
      await new Promise((res, rej) => {
        const tx = db.transaction(store, 'readwrite', { durability: 'relaxed' });
        const os = tx.objectStore(store);
        const end = Math.min(count, start + chunk);
        for (let i = start; i < end; i++) os.put(make(i));
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
    }
    return Math.round(performance.now() - t);
  }

  const n = plan.n;
  const took = {};
  const refId = (i) => `perf:ref:${i}`;
  took.references = await fill('references', n, (i) => {
    const title = phrase(1 + (i % 4));
    return {
      id: refId(i),
      title,
      normalizedTitle: title,
      category: pick(CATS),
      kind: pick(KINDS),
      decade: pick(DECADES),
      year: 1980 + (i % 45),
      sourceIds: [`perf:src:${i}`],
      tags: [pick(CATS)],
      editorialState: i % 2 ? 'source_curated' : 'retrieved',
      createdAt: iso(i),
      updatedAt: iso(i),
    };
  });
  took.interpretations = await fill('interpretations', n, (i) => ({
    id: `${refId(i)}#original`,
    referenceId: refId(i),
    label: phrase(2),
    gist: phrase(8),
    summary: phrase(25),
    context: phrase(20),
    usageExample: phrase(12),
    spoiler: 'none',
    sourceIds: [`perf:src:${i}`],
    provenance: 'source_supported',
    evidence: 'supported',
    selection: null,
    relation: 'original',
    createdAt: iso(i),
    updatedAt: iso(i),
  }));
  took.aliases = await fill('aliases', n, (i) => {
    const p = phrase(2);
    return {
      id: `perf:alias:${i}`,
      phrase: p,
      normalizedPhrase: `${p} ${i}`,
      referenceId: refId(i),
    };
  });
  took.sources = await fill('sources', n, (i) => ({
    id: `perf:src:${i}`,
    url: `https://en.wikipedia.org/wiki/Perf_${i}`,
    title: phrase(3),
    publisher: 'Wikipedia',
    sourceType: 'encyclopedia',
    retrievedAt: iso(i),
    license: 'CC BY-SA 4.0',
    excerpt: phrase(30),
  }));
  took.favourites = await fill('favourites', n, (i) => ({
    referenceId: refId(i),
    savedAt: iso(i),
  }));
  took.savedLinks = await fill('savedLinks', n, (i) => ({
    url: `https://example.org/perf/${i}`,
    title: phrase(4),
    savedAt: iso(i),
  }));
  const card = () => ({
    label: phrase(2),
    gist: phrase(8),
    means: phrase(10),
    reply: phrase(6),
    summary: [{ text: phrase(20), sources: [1] }],
    context: [{ text: phrase(20), sources: [2] }],
    example: { text: phrase(10), sources: [1] },
    spoiler: 'none',
  });
  took.draftCards = await fill('draftCards', n, (i) => ({
    id: `perf:draft:${i}`,
    search: phrase(2),
    card: card(),
    sources: [{ from: 'Wikipedia', title: phrase(3), url: `https://example.org/s/${i}` }],
    promptVersion: 'v1',
    savedAt: iso(i),
  }));
  took.curationJobs = await fill('curationJobs', n, (i) => ({
    id: `curation:perf-${i}`,
    status: 'completed',
    createdAt: iso(i),
    updatedAt: iso(i),
    request: {
      search: phrase(2),
      sources: Array.from({ length: 4 }, (_, k) => ({
        kind: 'web',
        title: phrase(3),
        text: phrase(40),
        url: `https://example.org/${i}/${k}`,
      })),
    },
    sent: Array.from({ length: 4 }, (_, k) => ({
      key: `${i}:${k}`,
      kind: 'web',
      from: 'Web',
      title: phrase(3),
      line: phrase(12),
    })),
    response: { card: card(), notUsed: [], provider: 'fake', promptVersion: 'v1' },
  }));
  const packCount = Math.max(1, Math.ceil(n / 100));
  took.packs = await fill('packs', packCount, (i) => {
    const name = `Perf pack ${i}`;
    return {
      id: `perf:pack:${i}`,
      name,
      normalizedName: name.toLowerCase(),
      ceiling: 'open',
      now: false,
      createdAt: iso(i),
      updatedAt: iso(i),
    };
  });
  took.packMembers = await fill('packMembers', n, (i) => ({
    id: `perf:pm:${i}`,
    packId: `perf:pack:${i % packCount}`,
    referenceId: refId(i),
    position: Math.floor(i / packCount),
    addedAt: iso(i),
  }));
  took.webResults = await fill('webResults', n, (i) => ({
    key: `perf query ${i}`,
    savedAt: Date.now() - (i % 20) * 86_400_000,
    results: Array.from({ length: 5 }, (_, k) => ({
      title: phrase(4),
      url: `https://example.org/w/${i}/${k}`,
      snippet: phrase(25),
      storage: 'device',
    })),
  }));
  const hist = Math.min(n, 200);
  took.searchHistory = await fill('searchHistory', hist, (i) => {
    const label = phrase(2);
    return {
      id: `perf:h:${i}`,
      tier: i % 4 ? 'recent' : 'frequent',
      label,
      spellings: [{ text: label, count: 1, lastSearchedAt: Date.now() - i * 60_000 }],
      referenceIds: [refId(i)],
      count: 1 + (i % 5),
      days: 1 + (i % 3),
      lastDay: Math.floor(Date.now() / 86_400_000),
      lastSearchedAt: Date.now() - i * 60_000,
      score: i % 97,
    };
  });
  db.close();
  return took;
}

// Times raw reads the way the repositories do them (whole table via getAll vs newest 50 by index).
async function idbTimings() {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('pop-culture-decoder');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const out = {};
  const run = (store, fn) =>
    new Promise((res, rej) => {
      const t = performance.now();
      const tx = db.transaction(store, 'readonly');
      const req = fn(tx.objectStore(store));
      req.onsuccess = () =>
        res({
          ms: Math.round(performance.now() - t),
          rows: Array.isArray(req.result) ? req.result.length : req.result,
        });
      req.onerror = () => rej(req.error);
    });
  const newest50 = (store, index) =>
    new Promise((res, rej) => {
      const t = performance.now();
      const tx = db.transaction(store, 'readonly');
      const rows = [];
      const req = tx.objectStore(store).index(index).openCursor(null, 'prev');
      req.onsuccess = () => {
        const c = req.result;
        if (c && rows.length < 50) {
          rows.push(c.value);
          c.continue();
        } else res({ ms: Math.round(performance.now() - t), rows: rows.length });
      };
      req.onerror = () => rej(req.error);
    });
  const tables = {
    references: 'createdAt',
    interpretations: null,
    aliases: null,
    sources: null,
    favourites: 'savedAt',
    savedLinks: 'savedAt',
    draftCards: 'savedAt',
    curationJobs: 'createdAt',
    packMembers: null,
    webResults: 'savedAt',
  };
  for (const [store, index] of Object.entries(tables)) {
    out[store] = { count: await run(store, (os) => os.count()) };
    out[store].getAll = await run(store, (os) => os.getAll());
    if (index && db.transaction(store).objectStore(store).indexNames.contains(index)) {
      out[store].newest50 = await newest50(store, index);
    }
  }
  db.close();
  return out;
}
