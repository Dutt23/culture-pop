import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { makeCandidate } from '../../test/factories';
import type { RetrievalResult } from '../../services/retrieval/types';
import { OnlineResults } from './OnlineResults';
import type { RetrievalState } from './useRetrieval';

const CANDIDATE = makeCandidate({ id: 'wikipedia:red-pill', title: 'Red pill and blue pill' });
const RESULT: RetrievalResult = {
  candidates: [CANDIDATE],
  outcomes: [{ provider: 'wikipedia', status: 'ok' }],
};

function show(state: RetrievalState) {
  render(
    <MemoryRouter>
      <OnlineResults
        query="red pill"
        preference="on"
        isOnline
        skipped={false}
        state={state}
        candidates={[CANDIDATE]}
        saved={[]}
        newCount={0}
        onShowNew={() => {}}
        onAllow={() => {}}
        onSkip={() => {}}
        onRetry={() => {}}
        onOpen={() => {}}
        favouriteOf={() => ({ isFavourite: false, onToggle: () => {} })}
      />
    </MemoryRouter>,
  );
}

const heart = () => screen.queryByRole('button', { name: 'Favourite Red pill and blue pill' });

describe('hearts on fresh online results', () => {
  // A favourite needs its reference in the library, or it would vanish from Favourites.
  it('are hidden while other sources are still answering', () => {
    show({ status: 'partial', result: RESULT });
    expect(screen.getByText('Red pill and blue pill')).toBeInTheDocument();
    expect(heart()).toBeNull();
  });

  it('are hidden when the results could not be saved', () => {
    show({ status: 'done', result: RESULT, cached: false });
    expect(heart()).toBeNull();
  });

  it('appear once the results are saved to the library', () => {
    show({ status: 'done', result: RESULT, cached: true });
    expect(heart()).toBeInTheDocument();
  });
});
