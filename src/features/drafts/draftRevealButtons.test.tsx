import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DraftCard, DraftResponse } from '../../../shared/cardTypes.js';
import type { MotionPreference } from '../../domain/settings';
import { MotionPreferenceProvider } from '../../motion/MotionPreferenceProvider';
import { DraftReveal } from './DraftReveal';
import type { Frame } from './frames';

const RESPONSE: DraftResponse = {
  card: {
    label: 'A dismissive comeback',
    gist: 'That opinion sounds out of touch.',
    means: 'They are brushing off your view as old-fashioned.',
    reply: 'Okay, Zoomer.',
    summary: [{ text: 'A catchphrase used to dismiss older attitudes.', sources: [0] }],
    context: [{ text: 'Often fired back in family chats.', sources: [0] }],
    example: null,
    spoiler: 'none',
  },
  notUsed: [],
  provider: 'fake',
  promptVersion: 'v2',
};
const SENT: Frame[] = [
  { key: 'a', kind: 'web', from: 'bbc.co.uk', title: 'OK boomer', line: '', url: 'https://a.test' },
];

/** Any decorative moment (plank, capsule, dark book) on the page. */
const fxLayer = () => document.querySelector('[data-fx]');
const button = (name: string) => screen.getByRole('button', { name });

function renderReveal(
  preference: MotionPreference = 'system',
  onKeep: (card: DraftCard) => Promise<void> = vi.fn(async () => {}),
) {
  const onDone = vi.fn();
  const view = render(
    <MotionPreferenceProvider preference={preference}>
      <DraftReveal response={RESPONSE} sent={SENT} onKeep={onKeep} onDone={onDone} />
    </MotionPreferenceProvider>,
  );
  return { ...view, onDone, onKeep };
}

afterEach(() => {
  MotionGlobalConfig.skipAnimations = true;
  // Only the unmount test stubs Web Animations; jsdom has none of its own.
  delete (Element.prototype as { animate?: unknown }).animate;
});

describe('Drop, Edit and Keep', () => {
  it('keep their names, with a decorative mark that adds nothing to them', () => {
    renderReveal();
    for (const name of ['Drop', 'Edit', 'Keep']) {
      const mark = button(name).querySelector('svg');
      expect(mark).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('Drop calls onDone(false) and walks the plank behind the scenes', () => {
    const { onDone } = renderReveal();
    fireEvent.click(button('Drop'));

    expect(onDone).toHaveBeenCalledWith(false);
    expect(fxLayer()).toHaveAttribute('data-fx', 'drop');
    expect(fxLayer()).toHaveAttribute('aria-hidden', 'true');
  });

  it('Keep starts the save on the tap, plays the capsule, then calls onDone(true)', async () => {
    let finishSave: () => void = () => {};
    const onKeep = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = () => resolve();
        }),
    );
    const { onDone } = renderReveal('system', onKeep);
    fireEvent.click(button('Keep'));

    // The save is under way before any animation has run.
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(fxLayer()).toHaveAttribute('data-fx', 'keep');
    expect(fxLayer()).toHaveAttribute('aria-hidden', 'true');
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => finishSave());
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
  });

  it('Keep clears the capsule when the save fails', async () => {
    const onKeep = vi.fn(async () => {
      throw new Error('offline');
    });
    const { onDone } = renderReveal('system', onKeep);
    fireEvent.click(button('Keep'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t keep the card');
    expect(fxLayer()).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
  });

  describe('under reduced motion', () => {
    it('Drop adds no moment and is done at once', () => {
      const { onDone } = renderReveal('reduce');
      fireEvent.click(button('Drop'));

      expect(onDone).toHaveBeenCalledWith(false);
      expect(fxLayer()).toBeNull();
    });

    it('Edit opens the fields at once, even with animations running', () => {
      MotionGlobalConfig.skipAnimations = false;
      renderReveal('reduce');
      fireEvent.click(button('Edit'));

      expect(screen.getByRole('textbox', { name: 'Gist' })).toBeInTheDocument();
      expect(fxLayer()).toBeNull();
    });

    it('Keep saves at once with no capsule', async () => {
      const { onKeep, onDone } = renderReveal('reduce');
      fireEvent.click(button('Keep'));

      expect(onKeep).toHaveBeenCalledTimes(1);
      expect(fxLayer()).toBeNull();
      await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    });
  });

  describe('with animations running', () => {
    it('Edit plays the dark book, hidden from readers, then opens the fields', async () => {
      // Skipped animations (test setup) still finish through the book's own completion.
      renderReveal();
      fireEvent.click(button('Edit'));

      expect(fxLayer()).toHaveAttribute('data-fx', 'edit');
      expect(fxLayer()).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByRole('textbox', { name: 'Gist' })).toBeNull();
      // A second tap while the book plays doesn't start another.
      fireEvent.click(button('Edit'));
      expect(document.querySelectorAll('[data-fx]')).toHaveLength(1);

      // The book's own completion opens the editor.
      expect(await screen.findByRole('textbox', { name: 'Gist' })).toBeInTheDocument();
      expect(fxLayer()).toBeNull();
    });

    it('unmounting mid-Edit leaves nothing behind and opens nothing late', () => {
      MotionGlobalConfig.skipAnimations = false;
      const { unmount, onDone, onKeep } = renderReveal();
      fireEvent.click(button('Edit'));
      expect(fxLayer()).not.toBeNull();

      unmount();

      expect(fxLayer()).toBeNull();
      expect(onDone).not.toHaveBeenCalled();
      expect(onKeep).not.toHaveBeenCalled();
    });

    it('unmounting mid-Drop cancels the walk, so onDone never comes', () => {
      // A walk that never finishes on its own: only cancel() can end it.
      const walk = { cancel: vi.fn(), onfinish: null as (() => void) | null };
      Element.prototype.animate = vi.fn(() => walk as unknown as Animation);
      const { unmount, onDone } = renderReveal();
      fireEvent.click(button('Drop'));
      expect(fxLayer()).toHaveAttribute('data-fx', 'drop');

      unmount();

      expect(walk.cancel).toHaveBeenCalled();
      expect(fxLayer()).toBeNull();
      expect(onDone).not.toHaveBeenCalled();
    });
  });
});
