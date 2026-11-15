import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeInterpretation } from '../test/factories';
import { FavouriteButton } from './favourite-button/FavouriteButton';
import { InterpretationCard } from './interpretation-card/InterpretationCard';
import { SearchBar } from './search-bar/SearchBar';

describe('InterpretationCard', () => {
  const spoiler = makeInterpretation('s', 'r', {
    label: 'The ending',
    summary: 'The hero turns to dust.',
    spoiler: 'major',
  });

  it('hides spoiler text and its revealing label by default', () => {
    render(<InterpretationCard interpretation={spoiler} index={0} revealSpoilers={false} />);
    expect(screen.queryByText('The hero turns to dust.')).not.toBeInTheDocument();
    expect(screen.queryByText('The ending')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spoiler-protected meaning' })).toBeInTheDocument();
  });

  it('reveals a spoiler only after an explicit tap', async () => {
    const user = userEvent.setup();
    render(<InterpretationCard interpretation={spoiler} index={0} revealSpoilers={false} />);
    await user.click(screen.getByRole('button', { name: 'Reveal spoiler' }));
    const revealed = await screen.findByText('The hero turns to dust.');
    expect(screen.getByRole('heading', { name: 'The ending' })).toBeInTheDocument();
    // Focus moves to the uncovered text so keyboard users don't lose their place.
    expect(revealed).toHaveFocus();
  });

  it('shows spoilers immediately when the user setting allows it', () => {
    render(<InterpretationCard interpretation={spoiler} index={0} revealSpoilers />);
    expect(screen.getByText('The hero turns to dust.')).toBeInTheDocument();
  });

  it('expands extra context with an accessible toggle', async () => {
    const user = userEvent.setup();
    render(
      <InterpretationCard
        interpretation={makeInterpretation('p', 'r', { context: 'Extra context' })}
        index={0}
        revealSpoilers={false}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'More context' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Extra context')).not.toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Less context' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(await screen.findByText('Extra context')).toBeInTheDocument();
  });

  it('labels demo provenance honestly', () => {
    render(
      <InterpretationCard interpretation={makeInterpretation('p', 'r')} index={0} revealSpoilers={false} />,
    );
    expect(screen.getByText(/not externally verified/)).toBeInTheDocument();
  });
});

describe('SearchBar', () => {
  it('has an accessible label and submits the current value', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SearchBar value="bazinga" onChange={() => undefined} onSubmit={onSubmit} />);
    expect(screen.getByRole('searchbox', { name: 'Search references' })).toHaveValue('bazinga');
    await user.click(screen.getByRole('button', { name: 'Decode' }));
    expect(onSubmit).toHaveBeenCalledWith('bazinga');
  });
});

describe('FavouriteButton', () => {
  it('exposes its state through aria-pressed with a stable name', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(<FavouriteButton isFavourite={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Favourite' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<FavouriteButton isFavourite onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Favourite' })).toHaveAttribute('aria-pressed', 'true');
  });
});
