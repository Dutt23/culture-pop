// Runtime baseline on a throttled phone profile: load, typing smoothness, memory, storage.
// Usage: serve a production build (npm run build && npm run preview -- --port 4174), then
//   node scripts/perf/measure.mjs http://localhost:4174
// Chrome on this computer with CPU and network throttling stands in for a phone: these are lab
// numbers for comparing before and after a change, not what a real phone will show.
import { chromium, devices } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:4174';
const RUNS = 3;
/** Chrome DevTools "Slow 4G"-like: 150 ms round trip, 1.6 Mbps down, 750 Kbps up. */
const NETWORK = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};
/** A mid-range phone is roughly four times slower than this laptop's CPU. */
const CPU_SLOWDOWN = 4;
const SEARCHES = [
  ...['hakuna matata', 'let it go', 'this is fine', 'bazinga', 'all izz well', 'the matrix'],
  ...['i am your father', 'point break', 'mogambo khush hua', 'say my name', 'winter is coming'],
  ...['to infinity and beyond', 'why so serious', 'hasta la vista', 'one does not simply'],
  ...['catch me outside', 'ok boomer', 'babu bhaiya', 'how you doin', 'whats up doc'],
];

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const ms = (value) => `${Math.round(value)} ms`;
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

async function phonePage(browser, options = {}) {
  const context = await browser.newContext({
    ...devices['Pixel 5'],
    viewport: { width: 390, height: 844 },
    ...options,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  // Paint, long-task and input timings, collected from the very first byte.
  await page.addInitScript(() => {
    const perf = { longTasks: [], events: [], lcp: 0 };
    window.__perf = perf;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) perf.longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) perf.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) perf.events.push({ name: e.name, duration: e.duration });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  });
  let jsBytes = 0;
  cdp.on('Network.loadingFinished', (e) => {
    jsBytes += e.encodedDataLength;
  });
  return { context, page, cdp, transferred: () => jsBytes, reset: () => (jsBytes = 0) };
}

async function loadMetrics(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return {
      fcp: fcp?.startTime ?? 0,
      lcp: window.__perf.lcp,
      domContentLoaded: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd,
      longTaskTotal: window.__perf.longTasks.reduce((a, b) => a + b, 0),
    };
  });
}

async function measureLoads(browser) {
  const cold = [];
  const warm = [];
  for (let run = 0; run < RUNS; run++) {
    const phone = await phonePage(browser);
    const start = Date.now();
    await phone.page.goto(BASE, { waitUntil: 'load' });
    await phone.page.getByRole('heading', { level: 1 }).first().waitFor();
    const discoverVisible = Date.now() - start;
    cold.push({ ...(await loadMetrics(phone.page)), discoverVisible, bytes: phone.transferred() });
    // Second visit: the service worker has cached the app shell.
    await phone.page
      .waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
        timeout: 30_000,
      })
      .catch(() => {});
    phone.reset();
    const again = Date.now();
    await phone.page.reload({ waitUntil: 'load' });
    await phone.page.getByRole('heading', { level: 1 }).first().waitFor();
    warm.push({
      ...(await loadMetrics(phone.page)),
      discoverVisible: Date.now() - again,
      bytes: phone.transferred(),
    });
    await phone.context.close();
  }
  return { cold, warm };
}

async function measureTyping(browser) {
  const phone = await phonePage(browser);
  await phone.page.goto(`${BASE}/search`, { waitUntil: 'load' });
  const box = phone.page.getByRole('searchbox').first();
  await box.waitFor();
  await phone.page.evaluate(() => {
    window.__perf.events.length = 0;
    window.__perf.longTasks.length = 0;
  });
  const typed = [];
  for (const query of SEARCHES.slice(0, 5)) {
    await box.fill('');
    await box.pressSequentially(query, { delay: 120 });
    await phone.page.waitForTimeout(400);
    typed.push(query);
  }
  const result = await phone.page.evaluate(() => {
    const keys = window.__perf.events.filter((e) =>
      ['keydown', 'keyup', 'keypress', 'input'].includes(e.name),
    );
    const durations = keys.map((e) => e.duration).sort((a, b) => a - b);
    return {
      slowInputs: durations.length,
      worstInput: durations.at(-1) ?? 0,
      p75Input: durations[Math.floor(durations.length * 0.75)] ?? 0,
      longTasks: window.__perf.longTasks.length,
      longTaskTotal: window.__perf.longTasks.reduce((a, b) => a + b, 0),
    };
  });
  const characters = typed.join('').length;
  await phone.context.close();
  return { ...result, characters };
}

const FIXTURES = new URL('../../src/services/retrieval/fixtures/', import.meta.url);
const fixture = async (name) =>
  JSON.parse(await (await import('node:fs/promises')).readFile(new URL(name, FIXTURES), 'utf8'));
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'api-user-agent',
};

/**
 * Typing while online results stream in: recorded provider answers (the e2e fixtures), each held
 * back a little so cards arrive one provider at a time, as they do on a phone.
 */
async function measureStreaming(browser) {
  const bodies = {
    'en.wikipedia.org': [await fixture('wikipedia-the-matrix.json'), 300],
    'query.wikidata.org': [await fixture('wikidata-the-matrix.json'), 900],
    'en.wiktionary.org': [await fixture('wiktionary-missing.json'), 500],
    'en.wikiquote.org': [{ batchcomplete: true, query: { search: [] } }, 600],
    'api.tvmaze.com': [[], 400],
  };
  const phone = await phonePage(browser, { serviceWorkers: 'block' });
  for (const [host, [json, delay]] of Object.entries(bodies)) {
    await phone.page.route(`https://${host}/**`, async (route) => {
      if (route.request().method() === 'OPTIONS')
        return route.fulfill({ status: 204, headers: CORS });
      await new Promise((resolve) => setTimeout(resolve, delay));
      return route.fulfill({ json, headers: CORS });
    });
  }
  await phone.page.goto(`${BASE}/search?q=the%20matri`, { waitUntil: 'load' });
  await phone.page.getByRole('button', { name: 'Search online' }).click();
  await phone.page.getByText('Found online').first().waitFor();
  await phone.page.evaluate(() => {
    window.__perf.events.length = 0;
    window.__perf.longTasks.length = 0;
  });
  const box = phone.page.getByRole('searchbox').first();
  const start = Date.now();
  // Each pause past the 500 ms debounce starts a lookup whose answers arrive while typing goes on.
  for (const query of ['the matrix', 'the matrix re', 'the matrix reloaded']) {
    await box.fill('');
    await box.pressSequentially(query, { delay: 120 });
    await phone.page.waitForTimeout(700);
  }
  await phone.page.mouse.wheel(0, 1500);
  await phone.page.waitForTimeout(2000);
  const result = await phone.page.evaluate(() => {
    const durations = window.__perf.events.map((e) => e.duration).sort((a, b) => a - b);
    return {
      slowEvents: durations.length,
      worstEvent: durations.at(-1) ?? 0,
      p75Event: durations[Math.floor(durations.length * 0.75)] ?? 0,
      longTasks: window.__perf.longTasks.length,
      longTaskTotal: window.__perf.longTasks.reduce((a, b) => a + b, 0),
      worstLongTask: Math.max(0, ...window.__perf.longTasks),
    };
  });
  await phone.context.close();
  return { ...result, seconds: (Date.now() - start) / 1000 };
}

async function heapUsed(cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
}

async function measureMemoryAndStorage(browser) {
  const phone = await phonePage(browser);
  await phone.cdp.send('Performance.enable');
  await phone.page.goto(BASE, { waitUntil: 'load' });
  await phone.page.getByRole('heading', { level: 1 }).first().waitFor();
  await phone.page.waitForTimeout(1000);
  const afterLoad = await heapUsed(phone.cdp);
  for (const query of SEARCHES) {
    await phone.page.goto(`${BASE}/search?q=${encodeURIComponent(query)}`);
    await phone.page
      .getByText(/in your library/)
      .first()
      .waitFor();
  }
  await phone.page.waitForTimeout(1000);
  const afterSearches = await heapUsed(phone.cdp);
  const storage = await phone.page.evaluate(async () => {
    const estimate = await navigator.storage.estimate();
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open('pop-culture-decoder');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const tables = {};
    for (const name of db.objectStoreNames) {
      const rows = await new Promise((resolve) => {
        const request = db.transaction(name).objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result);
      });
      tables[name] = { rows: rows.length, jsonBytes: JSON.stringify(rows).length };
    }
    db.close();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, tables };
  });
  await phone.context.close();
  return { afterLoad, afterSearches, searches: SEARCHES.length, storage };
}

const browser = await chromium.launch();
try {
  const loads = await measureLoads(browser);
  const typing = await measureTyping(browser);
  const streaming = await measureStreaming(browser);
  const memory = await measureMemoryAndStorage(browser);
  const summary = (runs) => ({
    discoverVisible: ms(median(runs.map((r) => r.discoverVisible))),
    fcp: ms(median(runs.map((r) => r.fcp))),
    lcp: ms(median(runs.map((r) => r.lcp))),
    load: ms(median(runs.map((r) => r.load))),
    longTaskTotal: ms(median(runs.map((r) => r.longTaskTotal))),
    transferred: kb(median(runs.map((r) => r.bytes))),
  });
  console.log(
    JSON.stringify(
      {
        profile: {
          cpuSlowdown: CPU_SLOWDOWN,
          network: 'Slow 4G-like (150 ms, 1.6 Mbps)',
          runs: RUNS,
        },
        coldLoad: summary(loads.cold),
        warmLoad: summary(loads.warm),
        typing: {
          characters: typing.characters,
          inputsOver16ms: typing.slowInputs,
          p75OfThose: ms(typing.p75Input),
          worstInput: ms(typing.worstInput),
          longTasks: typing.longTasks,
          longTaskTotal: ms(typing.longTaskTotal),
        },
        typingWhileOnlineResultsArrive: {
          seconds: streaming.seconds,
          eventsOver16ms: streaming.slowEvents,
          p75OfThose: ms(streaming.p75Event),
          worstEvent: ms(streaming.worstEvent),
          longTasks: streaming.longTasks,
          longTaskTotal: ms(streaming.longTaskTotal),
          worstLongTask: ms(streaming.worstLongTask),
        },
        memory: {
          heapAfterLoad: kb(memory.afterLoad),
          heapAfter20Searches: kb(memory.afterSearches),
          searches: memory.searches,
        },
        storage: {
          usage: kb(memory.storage.usage),
          tables: memory.storage.tables,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
