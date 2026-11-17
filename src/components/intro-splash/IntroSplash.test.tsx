import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/AppProviders';
import { createRepositories } from '../../data/repositories';
import { createTestDatabase } from '../../test/renderApp';
import { IntroSplash } from './IntroSplash';

async function renderIntro(motion?: 'reduce' | 'full') {
  const db = createTestDatabase();
  await db.open();
  if (motion) await createRepositories(db).settings.set('motion', motion);
  render(
    <AppProviders db={db}>
      <p>The app</p>
      <IntroSplash />
    </AppProviders>,
  );
  return screen.findByTestId('intro-splash');
}

afterEach(() => {
  sessionStorage.clear();
});

describe('IntroSplash', () => {
  it('flips through library lines and the costumed mascot, hidden from screen readers, and a tap skips it', async () => {
    const splash = await renderIntro('full');
    expect(splash).toHaveAttribute('aria-hidden', 'true');
    expect(await screen.findByText('Kitne aadmi the?')).toBeInTheDocument();
    expect(screen.getByText('The heroes')).toBeInTheDocument();
    // The app underneath is already there.
    expect(screen.getByText('The app')).toBeInTheDocument();

    fireEvent.pointerDown(splash);
    expect(screen.queryByTestId('intro-splash')).not.toBeInTheDocument();
  });

  it('is skipped by any key', async () => {
    await renderIntro('full');
    await screen.findByText('Kitne aadmi the?');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('intro-splash')).not.toBeInTheDocument();
  });

  it('plays once per visit', async () => {
    sessionStorage.setItem('pcd:intro-seen', '1');
    const db = createTestDatabase();
    await db.open();
    render(
      <AppProviders db={db}>
        <p>The app</p>
        <IntroSplash />
      </AppProviders>,
    );
    expect(await screen.findByText('The app')).toBeInTheDocument();
    expect(screen.queryByTestId('intro-splash')).not.toBeInTheDocument();
  });

  it('with reduced motion, shows no flip-book and fades straight away', async () => {
    await renderIntro('reduce');
    await waitFor(() => expect(screen.queryByTestId('intro-splash')).not.toBeInTheDocument());
    expect(screen.queryByText('Kitne aadmi the?')).not.toBeInTheDocument();
  });
});
