import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NO_FILTER, type ResultFilter } from '../../domain/discovery';
import { SearchFilters } from './SearchFilters';

function show(resultCount: number, value: ResultFilter = NO_FILTER) {
  render(
    <SearchFilters
      categories={[]}
      eras={['1990s', '2000s']}
      resultCount={resultCount}
      value={value}
      onChange={() => {}}
    />,
  );
}

describe('search filter chips', () => {
  it('stay hidden when there are three results or fewer, so the list starts high', () => {
    show(3);
    expect(screen.queryByRole('group', { name: 'Filter by era' })).not.toBeInTheDocument();
  });

  it('show once there are more results to sift', () => {
    show(4);
    expect(screen.getByRole('group', { name: 'Filter by era' })).toBeInTheDocument();
  });

  it('stay while an era is picked, so it can be undone', () => {
    show(1, { ...NO_FILTER, era: '1990s' });
    expect(screen.getByRole('button', { name: 'Any time' })).toBeInTheDocument();
  });
});
