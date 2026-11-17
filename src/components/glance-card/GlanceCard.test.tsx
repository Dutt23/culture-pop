import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { GlanceCard } from './GlanceCard';

const doh = buildSeed().interpretations.find((i) => i.id === 'doh-simpsons.1');
if (!doh) throw new Error('seed changed');

describe('GlanceCard', () => {
  it('shows only the lines that were written, never an empty label', () => {
    render(<GlanceCard interpretation={{ ...doh, socialMove: undefined, reply: undefined }} />);
    expect(screen.getByText('Means')).toBeInTheDocument();
    expect(screen.queryByText('When people say it')).not.toBeInTheDocument();
    expect(screen.queryByText('Say back')).not.toBeInTheDocument();
  });

  it('renders nothing when no glance line was written', () => {
    const { container } = render(
      <GlanceCard
        interpretation={{ ...doh, gist: undefined, socialMove: undefined, reply: undefined }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
