import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOADER_DELAY_MS, PageLoader } from './PageLoader';

describe('PageLoader', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing for a quick load, then the juggling mascot over placeholder cards', () => {
    vi.useFakeTimers();
    const { container } = render(<PageLoader />);
    act(() => vi.advanceTimersByTime(LOADER_DELAY_MS - 1));
    expect(container).toBeEmptyDOMElement();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('Juggling popcorn…')).toBeInTheDocument();
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });
});
