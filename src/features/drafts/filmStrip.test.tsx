import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToneCard } from '../../../shared/cardTypes.js';
import { MotionPreferenceProvider } from '../../motion/MotionPreferenceProvider';
import { CurationTray } from './CurationTray';
import { gradeOf, LIMIT_HINTS } from './curationLook';
import { FilmStrip } from './FilmStrip';
import type { Frame } from './frames';
import { ToneFilters } from './ToneFilters';
import { useCurationTray } from './useCurationTray';

const frames: Frame[] = Array.from({ length: 7 }, (_, i) => ({
  key: `app:${i}`,
  kind: 'app',
  from: 'app card',
  title: `Frame ${i + 1}`,
  line: `Line ${i + 1}`,
}));

const tone = (label: string): ToneCard => ({
  label,
  gist: 'g',
  means: 'm',
  reply: 'r',
  summary: 's',
});
const cards = [tone('Stonks'), tone('Bazinga!'), tone('Closer')];

// What Task 13's flow does: the hook's state, the three pieces, the grade on the root.
function Flow() {
  const tray = useCurationTray('ok boomer');
  const reelRef = useRef<SVGSVGElement>(null);
  const [shake, setShake] = useState({ key: 0, hint: '' });
  const limit = <R extends string>(result: R) => {
    if (result in LIMIT_HINTS) {
      setShake((s) => ({ key: s.key + 1, hint: LIMIT_HINTS[result as keyof typeof LIMIT_HINTS] }));
    }
    return result;
  };
  return (
    <div data-testid="root" style={gradeOf(tray.tones)}>
      <FilmStrip
        frames={frames}
        pickedKeys={new Set(tray.picked.map((f) => f.key))}
        onToggle={(f) => limit(tray.toggleFrame(f))}
        reelRef={reelRef}
      />
      <ToneFilters
        cards={cards}
        picked={tray.tones}
        onToggle={(c) => limit(tray.toggleTone(c))}
        reelRef={reelRef}
      />
      <CurationTray
        count={tray.picked.length}
        tones={tray.tones}
        onOpen={() => {}}
        shakeKey={shake.key}
        hint={shake.hint}
        reelRef={reelRef}
      />
    </div>
  );
}

const renderFlow = (preference: 'system' | 'reduce' = 'system') =>
  render(
    <MotionPreferenceProvider preference={preference}>
      <Flow />
    </MotionPreferenceProvider>,
  );

const frameButton = (n: number) => screen.getByRole('button', { name: new RegExp(`Frame ${n}`) });
const liveCount = () => document.querySelector('[aria-live="polite"]');

afterEach(() => {
  delete (Element.prototype as Partial<Element>).animate;
});

describe('film strip, filters and reel', () => {
  it('ticking a frame marks it pressed and updates the tray count', async () => {
    renderFlow();
    expect(liveCount()).toHaveTextContent('0 of 6 frames');

    await userEvent.click(frameButton(1));

    expect(frameButton(1)).toHaveAttribute('aria-pressed', 'true');
    expect(frameButton(2)).toHaveAttribute('aria-pressed', 'false');
    expect(liveCount()).toHaveTextContent('1 of 6 frames');
    expect(screen.getByRole('button', { name: 'Review 1 frame' })).toBeInTheDocument();
  });

  it('a 7th frame keeps the count at 6 and shows the limit hint', async () => {
    renderFlow();
    for (let n = 1; n <= 7; n++) await userEvent.click(frameButton(n));

    expect(frameButton(7)).toHaveAttribute('aria-pressed', 'false');
    expect(liveCount()).toHaveTextContent('6 of 6 frames');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('A card takes up to 6 frames.'),
    );
  });

  it('announces a repeated limit hint again', () => {
    vi.useFakeTimers();
    try {
      renderFlow();
      for (let n = 1; n <= 7; n++) fireEvent.click(frameButton(n));
      const status = screen.getByRole('status');
      act(() => vi.advanceTimersByTime(0));
      expect(status).toHaveTextContent('A card takes up to 6 frames.');

      fireEvent.click(frameButton(7)); // the same limit, while the first hint still shows
      expect(status).toBeEmptyDOMElement();
      act(() => vi.advanceTimersByTime(0));
      expect(status).toHaveTextContent('A card takes up to 6 frames.');

      act(() => vi.advanceTimersByTime(2000)); // cleared after the fade
      expect(status).toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a picked filter grades the reel', async () => {
    renderFlow();
    const root = screen.getByTestId('root');
    expect(root.style.getPropertyValue('--grade-1')).toBe('#b6aed6');

    await userEvent.click(screen.getByRole('button', { name: 'Stonks' }));

    expect(screen.getByRole('button', { name: 'Stonks' })).toHaveAttribute('aria-pressed', 'true');
    const g1 = root.style.getPropertyValue('--grade-1');
    expect(g1).not.toBe('#b6aed6');
    expect(root.style.getPropertyValue('--grade-2')).toBe(g1);
    expect(screen.getByText('Graded: Stonks')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bazinga!' }));
    await userEvent.click(screen.getByRole('button', { name: 'Closer' }));
    expect(screen.getByRole('button', { name: 'Closer' })).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Up to 2 colour filters.'),
    );
    expect(screen.getByText('Graded: Stonks + Bazinga!')).toBeInTheDocument();
  });

  it('places the rails once its scroll root opens, without any scrolling', () => {
    // The dialog is display: none when the strip mounts; it gets a size when showModal runs.
    let opened = false;
    const rect = (top: number, height: number) =>
      ({ top, bottom: top + height, height, left: 0, right: 0, width: 0 }) as DOMRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (!opened) return rect(0, 0);
      return this.tagName === 'DIALOG' ? rect(50, 600) : rect(120, 300);
    });
    const resized: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resized.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    function InDialog() {
      const root = useRef<HTMLDialogElement>(null);
      return (
        <dialog ref={root} open>
          <FilmStrip
            frames={frames}
            pickedKeys={new Set()}
            onToggle={() => 'added'}
            scrollRoot={root}
          />
        </dialog>
      );
    }
    try {
      render(
        <MotionPreferenceProvider preference="system">
          <InDialog />
        </MotionPreferenceProvider>,
      );
      const rail = document.querySelector<HTMLElement>('[data-rail]')!;
      expect(rail.style.display).toBe('none');

      opened = true;
      act(() => resized.forEach((callback) => callback([], {} as ResizeObserver)));

      // The strip runs from 120 to 420; the dialog's bottom (650) less the tray leaves all of it.
      expect(rail.style.display).toBe('');
      expect(rail.style.top).toBe('0px');
      expect(rail.style.height).toBe('300px');
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it('renders without motion when reduced motion is on', async () => {
    const animate = vi.fn(() => ({}) as Animation);
    Element.prototype.animate = animate;

    const full = renderFlow();
    await userEvent.click(frameButton(1));
    expect(animate).toHaveBeenCalled(); // the exposure flash and the fly
    full.unmount();

    animate.mockClear();
    renderFlow('reduce');
    await userEvent.click(frameButton(1));
    await userEvent.click(screen.getByRole('button', { name: 'Stonks' }));

    expect(animate).not.toHaveBeenCalled();
    expect(frameButton(1)).toHaveAttribute('aria-pressed', 'true');
    const tray = screen.getByRole('button', { name: 'Review 1 frame' });
    expect(within(tray).getByText('Graded: Stonks')).toBeInTheDocument();
  });
});
