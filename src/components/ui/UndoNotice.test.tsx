import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UndoNotice } from './UndoNotice';

describe('UndoNotice', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('catches focus the leaving card took with it, and says what Undo undoes', () => {
    render(<UndoNotice message="Removed “Stonks”." onUndo={() => {}} onExpire={() => {}} />);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toHaveFocus();
    expect(undo).toHaveAccessibleDescription('Removed “Stonks”.');
  });

  it('leaves focus where the page already put it', () => {
    render(<h1 tabIndex={-1}>Before X-Men</h1>);
    screen.getByRole('heading').focus();
    render(<UndoNotice message="Removed “Stonks”." onUndo={() => {}} onExpire={() => {}} />);
    expect(screen.getByRole('heading')).toHaveFocus();
  });

  it('stays while it holds focus, and goes 8 seconds after focus moves on', () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    render(
      <>
        <button type="button">Elsewhere</button>
        <UndoNotice message="Removed “Stonks”." onUndo={() => {}} onExpire={onExpire} />
      </>,
    );

    act(() => vi.advanceTimersByTime(30_000));
    expect(onExpire).not.toHaveBeenCalled();

    act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
    act(() => vi.advanceTimersByTime(7_999));
    expect(onExpire).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onExpire).toHaveBeenCalledOnce();
  });
});
