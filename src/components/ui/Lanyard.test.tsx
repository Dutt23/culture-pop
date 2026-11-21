import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Lanyard } from './Lanyard';

describe('Lanyard', () => {
  it('shows what it is given and is named by its title', () => {
    render(
      <Lanyard
        eyebrow="Backstage pass"
        title="Before X-Men"
        subtitle="Before you watch"
        tags={[{ label: 'Pinned', tone: 'accent' }]}
        actions={<button type="button">Open pack</button>}
      />,
    );
    const pass = screen.getByRole('article', { name: 'Before X-Men' });
    expect(within(pass).getByRole('heading', { level: 3, name: 'Before X-Men' })).toBeVisible();
    expect(within(pass).getByText('Backstage pass')).toBeInTheDocument();
    expect(within(pass).getByText('Before you watch')).toBeInTheDocument();
    expect(within(pass).getByRole('listitem')).toHaveTextContent('Pinned');
    expect(within(pass).getByRole('button', { name: 'Open pack' })).toBeInTheDocument();
  });

  it('punches one hole per step done and says the count in words', () => {
    const { container } = render(<Lanyard title="Pack" progress={{ done: 3, total: 5 }} />);
    expect(screen.getByText('3 of 5 done')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-punched]')).toHaveLength(3);
    expect(screen.getByRole('article')).not.toHaveAttribute('data-complete');
  });

  it('caps the holes for a long pack but keeps the true count, and clamps odd numbers', () => {
    const { container, rerender } = render(
      <Lanyard title="Pack" progress={{ done: 50, total: 100 }} />,
    );
    // Ten holes at most, each standing for ten cards here: half done, five punched.
    expect(container.querySelectorAll('[data-punched]')).toHaveLength(5);
    expect(screen.getByText('50 of 100 done')).toBeInTheDocument();
    rerender(<Lanyard title="Pack" progress={{ done: 9, total: 4 }} />);
    expect(screen.getByText('4 of 4 done')).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveAttribute('data-complete');
  });

  it('holds a panel: the head and its corner stay out of the scrolling body', () => {
    render(
      <Lanyard title="Make a card" corner={<button type="button">Close</button>}>
        <p>Panel content</p>
      </Lanyard>,
    );
    const pass = screen.getByRole('article', { name: 'Make a card' });
    const heading = within(pass).getByRole('heading', { name: 'Make a card' });
    const close = within(pass).getByRole('button', { name: 'Close' });
    const body = within(pass).getByText('Panel content').parentElement as HTMLElement;

    expect(pass).toHaveAttribute('data-panel');
    expect(body).not.toContainElement(heading);
    expect(body).not.toContainElement(close);
    // Close sits in the head, beside the title.
    expect(heading.closest('div')?.parentElement).toContainElement(close);
  });

  it('is a plain pass without children', () => {
    render(<Lanyard title="Pack" />);
    expect(screen.getByRole('article')).not.toHaveAttribute('data-panel');
  });

  it('stamps it when asked', () => {
    render(<Lanyard title="Pack" stamp="All access" />);
    expect(screen.getByText('All access')).toBeInTheDocument();
  });
});
