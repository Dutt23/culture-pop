// Scale benchmark with budgets (D69, docs/PERFORMANCE_PLAN.md). Fills the on-device database with
// N fake rows per growing table, opens each screen on a 4x slower CPU and fails when a budget is
// broken, including any slowdown for small users (0 and 100 rows) against the pre-D69 baseline.
//
// Usage: serve a production build, then
//   npm run build && npm run preview -- --port 4174
//   node scripts/perf/scale-bench.mjs http://localhost:4174 0 100 10000 100000
// Results go to scripts/perf/out/scale-<N>.json (git-ignored). Exit code 1 when any budget fails.
// Lab numbers from a slowed laptop, not a real phone: for before/after comparison.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [BASE = 'http://localhost:4174', ...volumeArgs] = process.argv.slice(2);
const VOLUMES = volumeArgs.length ? volumeArgs.map(Number) : [0, 100, 10_000, 100_000];
const CPU_SLOWDOWN = 4;
const PAGE_TIMEOUT_MS = 180_000;
const PAGES = [
  '/discover',
  '/search',
  '/favourites',
  '/activity',
  '/packs',
  '/references/perf:ref:0',
];
const SCROLLED = new Set(['/discover', '/favourites', '/activity', '/packs']);
const seedSource = readFileSync(join(here, 'scale-seed.js'), 'utf8');

/** Budgets from docs/PERFORMANCE_PLAN.md ("Budgets to enforce"). */
const BUDGET = {
  /** Discover settled (last long task ended) by this, ms. */
  startupBusyMs: (n) => (n <= 100 ? 1000 : 1500),
  /** No single main-thread task longer than this on any screen, ms. */
  longestTaskMs: 200,
  /**
   * Worst delay of one key press in Search, ms. The page itself costs about 200 ms per key on this
   * profile even with an empty library (measured before D69), so this guards against growth with
   * the library, not that floor.
   */
  keyPressMs: () => 300,
  /** JS heap when the first screen has settled, MB. */
  startupHeapMb: 40,
  /** JS heap on any screen, MB (budget set at 100,000 rows; also applied above). */
  screenHeapMb: 150,
  /** Elements in the page on any screen. */
  domNodes: 3000,
  /** 95th-percentile frame while scrolling a list, ms. */
  scrollP95FrameMs: 50,
  /**
   * Idle on Discover after 20 s untouched: no page layout at all (the mascot room's moving
   * drawings rest), and the fades the owner kept cost about 50 ms per second on this profile.
   */
  idleLayoutsPerSec: 1,
  idleCpuMsPerSec: 60,
};

/**
 * Pre-D69 numbers for a small user (100 rows): the old build measured by this same method on
 * 2026-11-21, median of 5 warm loads per screen ("busy until", ms). A screen may not get more than
 * 10% slower, with 50 ms of slack because single loads vary by that much.
 */
const SMALL_BASELINE = {
  100: {
    '/discover': 285,
    '/search': 84,
    '/favourites': 84,
    '/activity': 87,
    '/packs': 87,
    '/references/perf:ref:0': 87,
  },
};
const SMALL_KEY_PRESS_BASELINE = { 100: 200 };
const noSlowerThan = (baseline) => Math.max(baseline * 1.1, baseline + 50);
/** Each screen is opened this many times per volume and the middle result is used. */
const RUNS = 3;
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function prepare(page) {
  // The app needs an account (D66); the preview server has no /api, so the session is answered
  // here. No real credentials.
  await page.route('**/api/**', (route) =>
    route.request().url().includes('/api/auth/session')
      ? route.fulfill({
          json: { signedIn: true, email: 'reader@example.test', quota: null, widerWeb: true },
        })
      : route.fulfill({ status: 503, json: {} }),
  );
  await page.addInitScript(() => {
    localStorage.setItem('pcd-account', 'reader@example.test');
    for (const id of ['search', 'packs', 'pack']) localStorage.setItem(`pcd:tour-seen:${id}`, '1');
    sessionStorage.setItem('pcd:intro-seen', '1');
    window.__perf = { long: [], events: [] };
    new PerformanceObserver((list) =>
      list.getEntries().forEach((e) => window.__perf.long.push([e.startTime, e.duration])),
    ).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((list) =>
      list.getEntries().forEach((e) => window.__perf.events.push(e.duration)),
    ).observe({ type: 'event', durationThreshold: 16, buffered: true });
  });
}

/**
 * Waits until the main thread has had no long task for `quietMs` AND the page's element count
 * has stopped changing (a screen waiting on the database is quiet but not ready).
 */
async function settle(page, quietMs = 1500) {
  const start = Date.now();
  let lastCount = -1;
  let stableSince = Date.now();
  while (Date.now() - start < PAGE_TIMEOUT_MS) {
    const { sinceLong, count } = await page.evaluate(() => {
      const last = window.__perf.long.at(-1);
      return {
        sinceLong: last ? performance.now() - (last[0] + last[1]) : performance.now(),
        count: document.getElementsByTagName('*').length,
      };
    });
    if (count !== lastCount) {
      lastCount = count;
      stableSince = Date.now();
    }
    if (sinceLong > quietMs && Date.now() - stableSince > quietMs) return true;
    await sleep(250);
  }
  return false;
}

async function measureScreen(context, path) {
  const page = await context.newPage();
  await prepare(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  await page.goto(BASE + path, { waitUntil: 'load', timeout: PAGE_TIMEOUT_MS });
  const settled = await settle(page);
  const heap = await cdp.send('Runtime.getHeapUsage');
  const result = await page.evaluate(() => {
    const long = window.__perf.long;
    return {
      busyUntilMs: long.length ? Math.round(Math.max(...long.map(([s, d]) => s + d))) : 0,
      longestTaskMs: Math.round(Math.max(0, ...long.map(([, d]) => d))),
      domNodes: document.getElementsByTagName('*').length,
    };
  });
  return { page, cdp, result: { ...result, settled, heapMb: Math.round(heap.usedSize / 2 ** 20) } };
}

async function scrollP95(page) {
  return page.evaluate(async () => {
    const frames = [];
    let last = performance.now();
    const end = last + 3000;
    await new Promise((resolve) => {
      const step = (now) => {
        frames.push(now - last);
        last = now;
        window.scrollBy(0, 120);
        if (now < end) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    frames.sort((a, b) => a - b);
    return Math.round(frames[Math.floor(frames.length * 0.95)] ?? 0);
  });
}

async function worstKeyPress(page) {
  await page.evaluate(() => (window.__perf.events = []));
  const input = page.getByRole('searchbox').first();
  await input.click({ timeout: 30_000 });
  await input.pressSequentially('ka zu', { delay: 150 });
  await settle(page, 1000);
  return Math.round(Math.max(0, ...(await page.evaluate(() => window.__perf.events))));
}

async function idleCpu(page, cdp) {
  // Past the mascot room's 20 s rest, without touching the page.
  await sleep(21_000);
  await cdp.send('Performance.enable');
  const read = async () =>
    Object.fromEntries(
      (await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]),
    );
  const before = await read();
  await sleep(5000);
  const after = await read();
  return {
    cpuMsPerSec: Math.round(((after.TaskDuration - before.TaskDuration) * 1000) / 5),
    layoutsPerSec: (after.LayoutCount - before.LayoutCount) / 5,
  };
}

function check(failures, label, value, limit) {
  if (value > limit) failures.push(`${label}: ${value} > ${Math.round(limit)}`);
}

async function runVolume(n) {
  const profile = join(tmpdir(), `pcd-scale-${n}-${process.pid}`);
  rmSync(profile, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(profile, {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const failures = [];
  const out = { n, screens: {} };
  try {
    // The first visit creates the database (schema and built-in cards); then rows are added on a
    // page with no app code, so nothing holds the database open.
    const first = await measureScreen(context, '/discover');
    await first.page.close();
    if (n > 0) {
      const page = await context.newPage();
      await page.goto(BASE + '/icon.svg');
      await page.evaluate(`${seedSource}; seed(${JSON.stringify({ n })})`);
      await page.close();
    }
    for (const path of PAGES) {
      // Warm loads first; the last one also runs the scroll, typing and idle checks.
      const busy = [];
      for (let run = 1; run < RUNS; run += 1) {
        const warm = await measureScreen(context, path);
        busy.push(warm.result.busyUntilMs);
        await warm.page.close();
      }
      const { page, cdp, result } = await measureScreen(context, path);
      result.busyUntilMs = median([...busy, result.busyUntilMs]);
      if (SCROLLED.has(path)) result.scrollP95FrameMs = await scrollP95(page);
      if (path === '/search') result.worstKeyPressMs = await worstKeyPress(page);
      if (path === '/discover') {
        await page.evaluate(() => window.scrollTo(0, 0));
        result.idle = await idleCpu(page, cdp);
      }
      result.heapAfterMb = Math.round((await cdp.send('Runtime.getHeapUsage')).usedSize / 2 ** 20);
      await page.close();
      out.screens[path] = result;
      console.log(n, path, JSON.stringify(result));

      const at = `${n} rows ${path}`;
      if (!result.settled) failures.push(`${at}: never settled`);
      check(failures, `${at} longest task ms`, result.longestTaskMs, BUDGET.longestTaskMs);
      check(failures, `${at} heap MB`, result.heapAfterMb, BUDGET.screenHeapMb);
      check(failures, `${at} elements`, result.domNodes, BUDGET.domNodes);
      if (result.scrollP95FrameMs !== undefined) {
        check(failures, `${at} scroll p95 ms`, result.scrollP95FrameMs, BUDGET.scrollP95FrameMs);
      }
      if (path === '/discover') {
        check(failures, `${at} busy until ms`, result.busyUntilMs, BUDGET.startupBusyMs(n));
        check(failures, `${at} start-up heap MB`, result.heapMb, BUDGET.startupHeapMb);
        check(failures, `${at} idle CPU ms/s`, result.idle.cpuMsPerSec, BUDGET.idleCpuMsPerSec);
        check(
          failures,
          `${at} idle layouts/s`,
          result.idle.layoutsPerSec,
          BUDGET.idleLayoutsPerSec,
        );
      }
      if (result.worstKeyPressMs !== undefined) {
        check(failures, `${at} key press ms`, result.worstKeyPressMs, BUDGET.keyPressMs(n));
        const before = SMALL_KEY_PRESS_BASELINE[n];
        if (before !== undefined) {
          check(
            failures,
            `${at} key press vs before`,
            result.worstKeyPressMs,
            noSlowerThan(before),
          );
        }
      }
      const before = SMALL_BASELINE[n]?.[path];
      if (before !== undefined) {
        check(failures, `${at} busy until vs before`, result.busyUntilMs, noSlowerThan(before));
      }
    }
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
  out.failures = failures;
  return out;
}

const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });
let failed = 0;
for (const n of VOLUMES) {
  const result = await runVolume(n);
  writeFileSync(join(outDir, `scale-${n}.json`), JSON.stringify(result, null, 2));
  failed += result.failures.length;
  for (const failure of result.failures) console.error(`BUDGET FAILED  ${failure}`);
}
console.log(failed === 0 ? 'All budgets met.' : `${failed} budget(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
