import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeReference } from '../../test/factories';
import type { BrowseGroup } from './browseRows';
import { VirtualBrowse } from './VirtualBrowse';

const refs = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => makeReference(`${prefix}${i}`, `${prefix} ${i}`));

const groups: BrowseGroup[] = [
  { key: '1990s', title: '1990s', references: refs('a', 6) },
  { key: '2000s', title: '2000s', references: refs('b', 6) },
  { key: '2010s', title: '2010s', references: refs('c', 6) },
];

function renderBrowse() {
  return render(
    <MemoryRouter>
      <VirtualBrowse
        groups={groups}
        favouriteOf={() => ({ isFavourite: false, onToggle: () => {} })}
        noteOf={() => undefined}
      />
    </MemoryRouter>,
  );
}

describe('VirtualBrowse for screen readers', () => {
  // A phone-sized window: only the first few rows are near the screen (setup.ts makes it huge).
  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
  });
  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 100_000 });
  });

  it('keeps every heading in the page, even for groups whose cards are far off screen', async () => {
    renderBrowse();
    expect(await screen.findByRole('heading', { name: '2010s' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1990s' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2000s' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /a 0/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /c 5/ })).not.toBeInTheDocument();
  });

  it("tells each card its place in the whole group, not just in its row's list", async () => {
    renderBrowse();
    const second = (await screen.findByRole('link', { name: /a 1/ })).closest('li');
    expect(second).toHaveAttribute('aria-posinset', '2');
    expect(second).toHaveAttribute('aria-setsize', '6');
  });
});
