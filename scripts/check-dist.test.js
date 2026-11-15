import { describe, expect, it } from 'vitest';
import { findLeaks } from './check-dist.js';

describe('findLeaks', () => {
  it('passes a clean production build', () => {
    expect(
      findLeaks([
        { path: 'assets/index-abc123.js', content: 'createRoot(document.getElementById("root"))' },
        { path: 'sw.js', content: 'precacheAndRoute([])' },
        { path: 'icons/icon-192.png', content: '' },
      ]),
    ).toEqual([]);
  });

  it.each([
    ['assets/app.test.js', ''],
    ['fixtures/wikipedia-the-matrix.json', ''],
    ['assets/index.js.map', ''],
    ['test/setup.js', ''],
  ])('flags a forbidden file: %s', (path, content) => {
    expect(findLeaks([{ path, content }])).toHaveLength(1);
  });

  it.each(['fixtureRetrievalService', 'fake-indexeddb', 'Component gallery', '"batchcomplete"'])(
    'flags leaked test-only content: %s',
    (marker) => {
      expect(findLeaks([{ path: 'assets/index.js', content: `x ${marker} y` }])).toEqual([
        `assets/index.js: contains "${marker}"`,
      ]);
    },
  );
});
