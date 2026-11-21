import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionPreferenceProvider } from '../../motion/MotionPreferenceProvider';
import { MascotDen } from './MascotDen';
import { ROOM_PROPS, type RoomPropId } from './room/roomProps';

function SearchAt() {
  const { search } = useLocation();
  return <p>Searching {new URLSearchParams(search).get('q')}</p>;
}

function renderDen(still = false) {
  return render(
    <MotionPreferenceProvider preference="system">
      <MemoryRouter initialEntries={['/discover']}>
        <Routes>
          <Route
            path="/discover"
            element={
              <MascotDen still={still}>
                <input aria-label="Search" />
              </MascotDen>
            }
          />
          <Route path="/search" element={<SearchAt />} />
        </Routes>
      </MemoryRouter>
    </MotionPreferenceProvider>,
  );
}

const prop = (id: RoomPropId) => screen.getByRole('button', { name: ROOM_PROPS[id].thing });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the mascot room', () => {
  it('says what a tapped prop references, and only that one', async () => {
    const user = userEvent.setup();
    renderDen();

    await user.click(prop('interstellar'));

    const bubble = screen.getByRole('dialog', { name: 'Interstellar (2014)' });
    expect(bubble).toHaveAccessibleDescription(ROOM_PROPS.interstellar.line);
    expect(
      within(bubble)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Got it']);
  });

  it('"Know more" opens our Search with the reference filled in', async () => {
    const user = userEvent.setup();
    renderDen();

    await user.click(prop('roseWhip'));
    await user.click(screen.getByRole('link', { name: 'Know more' }));

    // The year in the title is left out of the search.
    expect(screen.getByText('Searching YuYu Hakusho')).toBeInTheDocument();
  });

  it('"Know more" uses a better search where the title alone is vague', async () => {
    const user = userEvent.setup();
    renderDen();

    await user.click(prop('swordInStone'));
    await user.click(screen.getByRole('link', { name: 'Know more' }));

    expect(screen.getByText('Searching Excalibur')).toBeInTheDocument();
  });

  it('closes with "Got it" or Escape and puts focus back on the prop', async () => {
    const user = userEvent.setup();
    renderDen();

    await user.click(prop('couch'));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(prop('couch')).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'The Big Bang Theory (2007)' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(prop('couch')).toHaveFocus();
  });

  it('opens with Space as a button does, and Escape on the prop closes it too', async () => {
    const user = userEvent.setup();
    renderDen();

    prop('jaws').focus();
    await user.keyboard(' ');
    expect(screen.getByRole('dialog', { name: 'Jaws (1975)' })).toBeInTheDocument();

    // A second tap on the same prop leaves focus on it.
    await user.click(prop('jaws'));
    expect(prop('jaws')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('swaps to another prop tapped while one is showing', async () => {
    const user = userEvent.setup();
    renderDen();

    await user.click(prop('kitt'));
    await user.click(prop('coin'));

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Sholay (1975)' })).toBeInTheDocument();
  });

  it('names every prop by what it looks like, never by what it is', () => {
    renderDen();
    for (const [id, { thing, title }] of Object.entries(ROOM_PROPS)) {
      const button = prop(id as RoomPropId);
      expect(button).toHaveAccessibleName(thing);
      expect(thing.toLowerCase()).not.toContain(title.toLowerCase());
    }
  });

  it('is one stop in the tab order, and arrow keys walk the props', async () => {
    const user = userEvent.setup();
    renderDen();

    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
    await user.tab();
    expect(prop('signal')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(prop('et')).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(prop('dhoom')).toHaveFocus();

    await user.tab();
    expect(document.activeElement?.getAttribute('data-room-prop')).toBeNull();
    await user.tab({ shift: true });
    expect(prop('dhoom')).toHaveFocus();
  });

  it('hands the tab stop back when the prop holding it is hidden by a resize', async () => {
    const user = userEvent.setup();
    renderDen();
    await user.tab();
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(prop('dhoom')).toHaveFocus();

    // The low row is for wide screens; the window narrows.
    const lowRow = prop('dhoom').closest('svg') as SVGSVGElement;
    lowRow.style.display = 'none';
    fireEvent(window, new Event('resize'));

    await user.click(screen.getByRole('textbox', { name: 'Search' }));
    await user.tab();
    expect(prop('signal')).toHaveFocus();
  });

  it('spells a word on the lights now and then, but not with reduced motion', () => {
    vi.useFakeTimers();
    const lit = () =>
      [...document.querySelectorAll('[data-on]')].map(
        (bulb) => bulb.nextElementSibling?.textContent,
      );

    const { unmount } = renderDen();
    act(() => vi.advanceTimersByTime(3000));
    expect(lit()).toEqual(['D']);
    act(() => vi.advanceTimersByTime(700));
    expect(lit()).toEqual(['E']);
    unmount();

    renderDen(true);
    act(() => vi.advanceTimersByTime(15000));
    expect(lit()).toEqual([]);
  });
});
