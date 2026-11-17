import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach, beforeEach } from 'vitest';

// jsdom has no layout or real frames: finish Motion animations instantly so exits never hang.
MotionGlobalConfig.skipAnimations = true;

// jsdom has no IntersectionObserver: everything counts as on screen, so in-view animations finish.
class OnScreenObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
  private readonly callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    const entry = { target, isIntersecting: true, intersectionRatio: 1 };
    this.callback(
      [entry as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
// No layout: a tall window lets a virtual list (Discover's Browse) put every row in the page, and
// the list's scroll corrections go nowhere instead of logging jsdom's "not implemented".
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 100_000 });
  window.scrollTo = () => {};
}
if (typeof IntersectionObserver === 'undefined') {
  Object.assign(globalThis, { IntersectionObserver: OnScreenObserver });
}

// The mascot tours open on a first visit; screen tests start as a returning reader. Tour tests
// remove these to see them.
const TOUR_SEEN_KEYS = ['pcd:tour-seen:packs', 'pcd:tour-seen:pack', 'pcd:tour-seen:search'];

beforeEach(() => {
  if (typeof localStorage === 'undefined') return;
  for (const key of TOUR_SEEN_KEYS) localStorage.setItem(key, '1');
});

afterEach(() => {
  // Server tests (api/, `@vitest-environment node`) have no DOM.
  if (typeof document === 'undefined') return;
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-motion');
});
