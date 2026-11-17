import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRepositories } from '../../data/repositories';
import { createTestDatabase, renderApp } from '../../test/renderApp';

// The shared test setup marks every tour seen; these tests start as a first-time reader.
beforeEach(() => {
  localStorage.removeItem('pcd:tour-seen:packs');
  localStorage.removeItem('pcd:tour-seen:pack');
  localStorage.removeItem('pcd:tour-seen:search');
});

const tour = () => screen.findByRole('dialog', { name: 'Tour' });

describe('mascot tours', () => {
  it('walks through the Packs page, outlining each part it talks about', async () => {
    const { user } = renderApp('/packs');
    const dialog = await tour();
    expect(within(dialog).getByText(/Packs are folders of cards/)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Next' })).toHaveFocus());

    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(await within(dialog).findByText(/hides the twists/)).toBeInTheDocument();
    const spoilers = document.querySelector('[data-tour="pack-spoilers"]');
    await waitFor(() => expect(spoilers).toHaveAttribute('data-tour-active'));

    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(document.querySelector('[data-tour="new-pack"]')).toHaveAttribute('data-tour-active'),
    );
    expect(spoilers).not.toHaveAttribute('data-tour-active');
  });

  it('shows once: Skip ends it and it stays away on the next visit', async () => {
    const first = renderApp('/packs');
    await first.user.click(within(await tour()).getByRole('button', { name: 'Skip' }));
    expect(screen.queryByRole('dialog', { name: 'Tour' })).not.toBeInTheDocument();
    first.unmount();

    renderApp('/packs');
    expect(await screen.findByRole('heading', { level: 1, name: 'Packs' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Tour' })).not.toBeInTheDocument();
  });

  it('closes with Escape', async () => {
    const { user } = renderApp('/packs');
    await tour();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Tour' })).not.toBeInTheDocument();
  });

  it('walks through a pack, starting at its search', async () => {
    const db = createTestDatabase();
    await db.open();
    const pack = await createRepositories(db).packs.create({
      name: 'Before X-Men',
      ceiling: 'before_watching',
    });
    renderApp(`/packs/${encodeURIComponent(pack.id)}`, db);
    expect(within(await tour()).getByText(/searches only this folder/)).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('[data-tour="pack-search-in"]')).toHaveAttribute(
        'data-tour-active',
      ),
    );
  });

  it('walks through search, from the search box to the tags', async () => {
    const { user } = renderApp('/search');
    const dialog = await tour();
    expect(within(dialog).getByText(/paste a whole message/)).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('[data-tour="search-bar"]')).toHaveAttribute(
        'data-tour-active',
      ),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(await within(dialog).findByText(/Tags put that kind first/)).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('[data-tour="search-tags"]')).toHaveAttribute(
        'data-tour-active',
      ),
    );
  });

  it('replays from Settings even after it was seen', async () => {
    localStorage.setItem('pcd:tour-seen:packs', '1');
    const { user } = renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Tour packs' }));
    expect(within(await tour()).getByText(/Packs are folders of cards/)).toBeInTheDocument();
    await user.click(within(await tour()).getByRole('button', { name: 'Skip' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Tour' })).not.toBeInTheDocument(),
    );
  });
});
