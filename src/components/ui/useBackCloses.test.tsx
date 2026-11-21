import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserLikeBack, settle } from '../../test/browserBack';
import { OVERLAY_MARK, useBackCloses } from './useBackCloses';

function Overlay({ onClose, stayOpen }: { onClose: () => void; stayOpen?: boolean }) {
  useBackCloses(onClose, { stayOpen });
  return <p>Overlay open</p>;
}

/** The phone's Back: the overlay's entry is left for one without a mark. */
function pressBack() {
  act(() => {
    window.history.replaceState(null, '');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

const mark = () => (window.history.state as Record<string, unknown> | null)?.[OVERLAY_MARK];

beforeEach(() => window.history.replaceState(null, ''));
afterEach(() => vi.restoreAllMocks());

describe('useBackCloses', () => {
  it('stays open under StrictMode, with one entry of its own (owner bug, 2026-11-22)', async () => {
    const back = browserLikeBack();
    const onClose = vi.fn();
    const before = window.history.length;
    render(
      <StrictMode>
        <Overlay onClose={onClose} />
      </StrictMode>,
    );
    await settle();

    expect(onClose).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    expect(mark()).toEqual(expect.any(String));
    expect(window.history.length).toBe(before + 1);
  });

  it('Back closes it', async () => {
    const onClose = vi.fn();
    render(
      <StrictMode>
        <Overlay onClose={onClose} />
      </StrictMode>,
    );
    await settle();
    pressBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closing another way steps back off its entry once, a task later', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { unmount } = render(
      <StrictMode>
        <Overlay onClose={vi.fn()} />
      </StrictMode>,
    );
    await settle();
    unmount();
    expect(back).not.toHaveBeenCalled();
    await settle();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('after Back has closed it, it does not step back again', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { unmount } = render(<Overlay onClose={vi.fn()} />);
    await settle();
    pressBack();
    unmount();
    await settle();
    expect(back).not.toHaveBeenCalled();
  });

  it('while work runs, Back is refused and the entry put back', async () => {
    const onClose = vi.fn();
    render(<Overlay onClose={onClose} stayOpen />);
    await settle();
    pressBack();
    expect(onClose).not.toHaveBeenCalled();
    expect(mark()).toEqual(expect.any(String));
  });

  it('with two open, Back closes only the one on top', async () => {
    const lower = vi.fn();
    const upper = vi.fn();
    render(<Overlay onClose={lower} />);
    await settle();
    const lowerState = window.history.state as unknown;
    render(<Overlay onClose={upper} />);
    await settle();

    // Back from the upper entry lands on the lower overlay's own entry.
    act(() => {
      window.history.replaceState(lowerState, '');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
    expect(screen.getAllByText('Overlay open')).toHaveLength(2);
  });
});
