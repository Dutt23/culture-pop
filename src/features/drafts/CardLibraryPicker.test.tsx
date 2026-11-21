import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CardLibraryPicker, type LibraryPickerCard } from './CardLibraryPicker';

const cards: LibraryPickerCard[] = [
  {
    id: 'reference:one',
    title: 'Hakuna Matata',
    description: 'A carefree phrase from The Lion King.',
    frame: {
      key: 'app:one',
      kind: 'app',
      from: 'app card',
      title: 'Hakuna Matata',
      line: 'No worries.',
    },
    tone: { label: 'Hakuna Matata', gist: 'No worries.', means: '', reply: '', summary: '' },
  },
  {
    id: 'draft:two',
    title: 'Saved search (spoiler)',
    description: 'Spoiler hidden.',
    tone: {
      label: 'Saved search (spoiler)',
      gist: 'SECRET ENDING',
      means: '',
      reply: '',
      summary: '',
    },
  },
];

describe('saved card picker', () => {
  it('searches visible title and description and toggles a source by keyboard', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CardLibraryPicker
        cards={cards}
        mode="source"
        selected={['reference:one']}
        onSelect={onSelect}
      />,
    );
    const search = screen.getByRole('searchbox', { name: 'Search saved cards' });
    await user.type(search, 'lion carefree');
    const card = screen.getByRole('button', { name: /Hakuna Matata/ });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    card.focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(cards[0]);
    await user.clear(search);
    await user.type(search, 'missing');
    expect(screen.getByRole('status')).toHaveTextContent('No saved cards match');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Saved search (spoiler)')).toBeNull();
  });

  it('matches style selections by label and keeps hidden payload text out of search', async () => {
    const user = userEvent.setup();
    render(
      <CardLibraryPicker
        cards={cards}
        mode="style"
        selected={['Saved search (spoiler)']}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Saved search/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/guide tone and structure/)).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'secret ending');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('No saved cards match');
  });

  it('explains how to populate an empty library', () => {
    render(<CardLibraryPicker cards={[]} mode="source" selected={[]} onSelect={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Save a favourite or keep a draft');
  });
});
