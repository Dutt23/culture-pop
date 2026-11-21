import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualCollection } from './VirtualCollection';
import { DRAW_ALL_UP_TO } from './virtualCollectionLayout';

const ESTIMATE = 100;
const makeItems = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `item-${i}` }));

let originalHeight: number;
beforeEach(() => {
  // The shared test setup uses a very tall window; here the window is a phone-sized 768px.
  originalHeight = window.innerHeight;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
});
afterEach(() => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
});

function renderList(items: { id: string }[], total: number, onNeedMore?: () => void) {
  return render(
    <VirtualCollection
      label="Things"
      items={items}
      total={total}
      getKey={(item) => item.id}
      renderItem={(item) => <span>{item.id}</span>}
      estimateSize={ESTIMATE}
      onNeedMore={onNeedMore}
    />,
  );
}

describe('VirtualCollection', () => {
  it(`draws every item when the list has ${DRAW_ALL_UP_TO} or fewer`, () => {
    renderList(makeItems(DRAW_ALL_UP_TO), DRAW_ALL_UP_TO);
    expect(screen.getAllByRole('listitem')).toHaveLength(DRAW_ALL_UP_TO);
    expect(screen.getByText('item-0')).toBeInTheDocument();
    expect(screen.getByText(`item-${DRAW_ALL_UP_TO - 1}`)).toBeInTheDocument();
  });

  it('draws only the rows near the screen for 500 items, each at its true place', async () => {
    renderList(makeItems(500), 500);
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0));
    const shown = screen.getAllByRole('listitem');
    expect(shown.length).toBeLessThan(60);
    for (const item of shown) expect(item).toHaveAttribute('aria-setsize', '500');
    // The first drawn item is the first in the list, and places count up from there.
    expect(shown[0]).toHaveTextContent('item-0');
    shown.forEach((item, i) => {
      expect(item).toHaveAttribute('aria-posinset', String(i + 1));
      expect(item).toHaveTextContent(`item-${i}`);
    });
    expect(screen.queryByText('item-499')).not.toBeInTheDocument();
  });

  it('asks for more when the end of what has been read is near and more exist', async () => {
    const onNeedMore = vi.fn();
    renderList(makeItems(10), 500, onNeedMore);
    await waitFor(() => expect(onNeedMore).toHaveBeenCalled());
  });

  it('does not ask for more when the end is far from the screen', async () => {
    const onNeedMore = vi.fn();
    renderList(makeItems(300), 500, onNeedMore);
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0));
    expect(onNeedMore).not.toHaveBeenCalled();
  });

  it('does not ask for more once every item has been read', async () => {
    const onNeedMore = vi.fn();
    renderList(makeItems(20), 20, onNeedMore);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(20));
    expect(onNeedMore).not.toHaveBeenCalled();
  });
});
