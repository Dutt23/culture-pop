import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BusyButton, useBusy } from './BusyButton';

/** A save button wired the way pages use it: `useBusy` + `BusyButton`. */
function Saver({ work }: { work: () => Promise<void> }) {
  const [busy, run] = useBusy();
  return (
    <BusyButton busy={busy} busyLabel="Saving…" onClick={() => void run(work).catch(() => {})}>
      Save
    </BusyButton>
  );
}

function deferred() {
  let settle: { resolve: () => void; reject: (e: Error) => void } = {
    resolve: () => {},
    reject: () => {},
  };
  const promise = new Promise<void>((resolve, reject) => {
    settle = { resolve, reject };
  });
  return { promise, ...settle };
}

describe('BusyButton with useBusy', () => {
  it('greys out and says what it is doing while busy, then comes back after success', async () => {
    const job = deferred();
    const work = vi.fn(() => job.promise);
    render(<Saver work={work} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(work).toHaveBeenCalledTimes(1);

    await act(async () => job.resolve());
    const back = screen.getByRole('button', { name: 'Save' });
    expect(back).not.toHaveAttribute('aria-disabled');
    expect(back).toHaveAttribute('aria-busy', 'false');
  });

  it('comes back after an error too', async () => {
    const job = deferred();
    render(<Saver work={() => job.promise} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
    await act(async () => job.reject(new Error('disk full')));
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-disabled');
  });

  it('does not submit its form again while busy (Enter or a second tap)', () => {
    const submit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <BusyButton type="submit" busy busyLabel="Creating…">
          Create
        </BusyButton>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Creating…' }));
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps keyboard focus on the button while busy', () => {
    const { rerender } = render(
      <BusyButton busy={false} busyLabel="Saving…">
        Save
      </BusyButton>,
    );
    screen.getByRole('button').focus();
    rerender(
      <BusyButton busy busyLabel="Saving…">
        Save
      </BusyButton>,
    );
    expect(screen.getByRole('button', { name: 'Saving…' })).toHaveFocus();
  });
});
