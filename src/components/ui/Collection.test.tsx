import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Collection } from './Collection';

const ITEMS = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
];

describe('Collection', () => {
  it('renders each item with the renderer, as a named list', () => {
    render(
      <Collection
        label="Letters"
        items={ITEMS}
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.name}</span>}
      />,
    );
    const list = screen.getByRole('list', { name: 'Letters' });
    expect(list).toHaveAttribute('data-variant', 'rows');
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
  });

  it('shows the empty state instead of an empty list', () => {
    render(
      <Collection
        label="Letters"
        items={[]}
        getKey={(item: { id: string }) => item.id}
        renderItem={() => null}
        empty={<p>Nothing yet</p>}
      />,
    );
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('a film strip can be scrolled from the keyboard', () => {
    render(
      <Collection
        label="Frames"
        variant="frames"
        items={ITEMS}
        getKey={(item) => item.id}
        renderItem={(item) => item.name}
      />,
    );
    expect(screen.getByRole('list', { name: 'Frames' })).toHaveAttribute('tabindex', '0');
  });

  it('a virtualised slice still tells each item its true place in the whole list', () => {
    render(
      <Collection
        label="Huge"
        items={ITEMS}
        window={{ start: 5000, total: 1_000_000 }}
        getKey={(item) => item.id}
        renderItem={(item, index) => `${item.name} #${index}`}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('aria-posinset', '5001');
    expect(items[0]).toHaveAttribute('aria-setsize', '1000000');
    expect(items[2]).toHaveTextContent('Charlie #5002');
  });
});

describe('Collection for a virtualiser', () => {
  it('hands over the list element and keeps room for rows that are not drawn', () => {
    let list: HTMLUListElement | null = null;
    render(
      <Collection
        label="Huge"
        items={ITEMS}
        getKey={(item) => item.id}
        renderItem={(item) => item.name}
        listRef={(el) => {
          list = el;
        }}
        padStart={4000}
        padEnd={1200}
      />,
    );
    expect(list).toBe(screen.getByRole('list', { name: 'Huge' }));
    const style = screen.getByRole('list', { name: 'Huge' }).style;
    expect(style.getPropertyValue('--pad-start')).toBe('4000px');
    expect(style.getPropertyValue('--pad-end')).toBe('1200px');
  });

  it('a film strip gets the same room (the CSS puts it sideways, inside the strip)', () => {
    render(
      <Collection
        label="Strip"
        variant="frames"
        items={ITEMS}
        getKey={(item) => item.id}
        renderItem={(item) => item.name}
        padStart={800}
      />,
    );
    const strip = screen.getByRole('list', { name: 'Strip' });
    expect(strip.style.getPropertyValue('--pad-start')).toBe('800px');
    expect(strip).toHaveAttribute('data-variant', 'frames');
  });
});
