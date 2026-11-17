import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach, beforeEach } from 'vitest';

// jsdom has no layout or real frames: finish Motion animations instantly so exits never hang.
MotionGlobalConfig.skipAnimations = true;

// The mascot tours open on a first visit; screen tests start as a returning reader. Tour tests
// remove these to see them.
const TOUR_SEEN_KEYS = ['pcd:tour-seen:packs', 'pcd:tour-seen:pack'];

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
