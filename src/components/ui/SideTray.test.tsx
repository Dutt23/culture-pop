import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AnimatePresence } from 'motion/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserLikeBack, settle } from '../../test/browserBack';
import { SideTray, type SideTrayLook } from './SideTray';

const ITEMS = Array.from({ length: 60 }, (_, i) => `Item ${i + 1}`);

/** A page with a button that opens a tray holding a long list and a pinned action. */
function Host({ stayOpen = false, look }: { stayOpen?: boolean; look?: SideTrayLook }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={opener} type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <AnimatePresence>
        {open && (
          <SideTray
            title="Long list"
            opener={opener}
            stayOpen={stayOpen}
            look={look}
            onClose={() => setOpen(false)}
            footer={<button type="button">Pinned action</button>}
          >
            <ul>
              {ITEMS.map((item) => (
                <li key={item}>
                  <a href={`#${item}`}>{item}</a>
                </li>
              ))}
            </ul>
          </SideTray>
        )}
      </AnimatePresence>
    </>
  );
}

// Closing the tray steps history back; jsdom does that late, into the next test. Not here.
beforeEach(() => {
  window.history.replaceState(null, '');
  vi.spyOn(window.history, 'back').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SideTray', () => {
  it.each(['tv', 'carried'] as const)(
    'opens and stays open under StrictMode, as in development (%s look)',
    async (look) => {
      browserLikeBack();
      render(<Host look={look} />, { reactStrictMode: true });
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      await screen.findByRole('dialog', { name: 'Long list' });
      await settle();
      expect(screen.getByRole('dialog', { name: 'Long list' })).toBeInTheDocument();
    },
  );

  it('scrolls a long list on its own while the title and the footer stay outside it', async () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const tray = await screen.findByRole('dialog', { name: 'Long list' });
    const list = within(tray).getByRole('list');
    const scroller = list.parentElement;
    expect(within(tray).getAllByRole('listitem')).toHaveLength(ITEMS.length);
    expect(scroller).not.toBeNull();
    const pinned = [
      within(tray).getByRole('button', { name: 'Pinned action' }),
      within(tray).getByRole('heading', { name: 'Long list' }),
      within(tray).getByRole('button', { name: 'Close' }),
    ];
    for (const element of pinned) expect(scroller).not.toContainElement(element);
  });

  it('Close shuts it and gives focus back to what opened it', async () => {
    render(<Host />);
    const open = screen.getByRole('button', { name: 'Open' });
    fireEvent.click(open);
    const tray = await screen.findByRole('dialog', { name: 'Long list' });
    fireEvent.click(within(tray).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(open).toHaveFocus();
  });

  it('stays open while its work is running', async () => {
    render(<Host stayOpen />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const tray = await screen.findByRole('dialog', { name: 'Long list' });
    fireEvent.click(within(tray).getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(tray, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Long list' })).toBeInTheDocument();
  });

  it.each(['tv', 'carried'] as const)('works the same in the %s look', async (look) => {
    render(<Host look={look} />);
    const open = screen.getByRole('button', { name: 'Open' });
    fireEvent.click(open);
    const tray = await screen.findByRole('dialog', { name: 'Long list' });
    expect(tray).toHaveAttribute('data-look', look);
    expect(within(tray).getByRole('button', { name: 'Pinned action' })).toBeInTheDocument();
    fireEvent.keyDown(tray, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(open).toHaveFocus();
  });
});
