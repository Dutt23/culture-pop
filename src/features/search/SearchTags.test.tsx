import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MAX_CUSTOM_TAGS } from '../../domain/searchTags';
import { makeReference } from '../../test/factories';
import { createTestDatabase, renderApp } from '../../test/renderApp';

const LION_KING = /Hakuna Matata \(The Lion King\)/;
const SWAHILI = /Hakuna matata \(Swahili phrase\)/;

/** The two library results for "hakuna", top first. */
async function hakunaOrder(): Promise<string[]> {
  await screen.findByRole('link', { name: LION_KING });
  return screen
    .getAllByRole('link', { name: /Hakuna (Matata|matata) \(/ })
    .map((link) => (LION_KING.test(link.textContent ?? '') ? 'lion king' : 'swahili'));
}

/** The tag row shows once stored tags are read, a moment after the page. */
const tagRow = () => screen.findByRole('group', { name: /Search tags/ });

describe('search tags', () => {
  it('shows the tags before searching and remembers a tapped one on this device', async () => {
    const db = createTestDatabase();
    const { user, unmount } = renderApp('/search', db);
    const anime = within(await screen.findByRole('group', { name: /Search tags/ })).getByRole(
      'button',
      { name: 'Anime' },
    );
    expect(anime).toHaveAttribute('aria-pressed', 'false');
    // "Only these" belongs to results, so it waits for a search.
    expect(screen.queryByRole('button', { name: 'Only these' })).not.toBeInTheDocument();

    await user.click(anime);
    expect(anime).toHaveAttribute('aria-pressed', 'true');
    await waitFor(async () => expect(await db.settings.get('searchTags')).toBeDefined());
    unmount();

    renderApp('/search', db);
    expect(within(await tagRow()).getByRole('button', { name: 'Anime' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('lifts tagged results without hiding the rest; "Only these" hides them', async () => {
    const { user } = renderApp('/search?q=hakuna');
    expect(await hakunaOrder()).toEqual(['swahili', 'lion king']);

    await user.click(within(await tagRow()).getByRole('button', { name: 'Cartoons' }));
    await waitFor(async () => expect(await hakunaOrder()).toEqual(['lion king', 'swahili']));

    await user.click(within(await tagRow()).getByRole('button', { name: 'Only these' }));
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: SWAHILI })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: LION_KING })).toBeInTheDocument();

    // Turning the last tag off lets "Only these" go, so nothing stays hidden with no way back.
    await user.click(within(await tagRow()).getByRole('button', { name: 'Cartoons' }));
    expect(await screen.findByRole('link', { name: SWAHILI })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Only these' })).not.toBeInTheDocument();
  });

  it('explains an empty Only these view and restores results when it is turned off', async () => {
    const { user } = renderApp('/search?q=hakuna');
    await hakunaOrder();
    const row = within(await tagRow());
    await user.click(row.getByRole('button', { name: 'Music' }));
    await user.click(row.getByRole('button', { name: 'Only these' }));
    expect(await screen.findByText(/No results match these tags/)).toBeInTheDocument();
    await user.click(row.getByRole('button', { name: 'Only these' }));
    expect(await screen.findByRole('link', { name: SWAHILI })).toBeInTheDocument();
  });

  it('adds, refuses a repeat, and removes a custom tag', async () => {
    const db = createTestDatabase();
    const { user } = renderApp('/search', db);
    await user.click(await screen.findByRole('button', { name: /Add tag/ }));
    await user.type(screen.getByRole('textbox', { name: 'New tag' }), 'Marvel{Enter}');
    expect(within(await tagRow()).getByRole('button', { name: 'Marvel' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /Add tag/ }));
    await user.type(screen.getByRole('textbox', { name: 'New tag' }), 'marvel{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('You already have that tag.');
    await user.clear(screen.getByRole('textbox', { name: 'New tag' }));
    await user.type(screen.getByRole('textbox', { name: 'New tag' }), '<b>{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent(/letters, numbers or spaces/);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Remove tag Marvel' }));
    expect(
      within(await tagRow()).queryByRole('button', { name: 'Marvel' }),
    ).not.toBeInTheDocument();
    await waitFor(async () =>
      expect(JSON.parse((await db.settings.get('searchTags'))?.value ?? '{}')).toEqual({
        types: [],
        custom: [],
      }),
    );
  });

  it(`keeps at most ${MAX_CUSTOM_TAGS} custom tags`, async () => {
    const db = createTestDatabase();
    await db.open();
    const custom = Array.from({ length: MAX_CUSTOM_TAGS }, (_, i) => ({
      text: `tag ${i}`,
      on: false,
    }));
    await db.settings.add({ key: 'searchTags', value: JSON.stringify({ types: [], custom }) });
    const { user } = renderApp('/search', db);
    await screen.findByRole('button', { name: 'tag 7' });

    await user.click(screen.getByRole('button', { name: /Add tag/ }));
    await user.type(screen.getByRole('textbox', { name: 'New tag' }), 'One more{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent(
      `You can keep up to ${MAX_CUSTOM_TAGS} tags. Remove one first.`,
    );
    expect(screen.queryByRole('button', { name: 'One more' })).not.toBeInTheDocument();
  });
});

describe('taste lean', () => {
  /** Three cartoon favourites: the seed's two and one more. */
  async function cartoonFan() {
    const db = createTestDatabase();
    await db.open();
    await db.references.add(makeReference('test-cartoon', 'Test Cartoon', { category: 'cartoon' }));
    const savedAt = '2026-11-17T00:00:00.000Z';
    await db.favourites.bulkAdd(
      ['hakuna-matata-lion-king', 'doh-simpsons', 'test-cartoon'].map((referenceId) => ({
        referenceId,
        savedAt,
      })),
    );
    return db;
  }

  it('breaks a tie toward the favourite type and says why', async () => {
    renderApp('/search?q=hakuna', await cartoonFan());
    expect(
      await screen.findByText('Cartoons ranked a little higher because of your favourites.'),
    ).toBeInTheDocument();
    expect(await hakunaOrder()).toEqual(['lion king', 'swahili']);
  });

  it('says nothing when the lean changes nothing', async () => {
    renderApp('/search?q=bazinga', await cartoonFan());
    await screen.findByRole('link', { name: /Bazinga!/ });
    expect(screen.queryByText(/ranked a little higher/)).not.toBeInTheDocument();
  });

  it('is switched off in Settings', async () => {
    const db = await cartoonFan();
    await db.settings.add({ key: 'taste', value: 'off' });
    renderApp('/search?q=hakuna', db);
    expect(await hakunaOrder()).toEqual(['swahili', 'lion king']);
    expect(screen.queryByText(/ranked a little higher/)).not.toBeInTheDocument();
  });

  it('has an On/Off switch on the Settings page', async () => {
    const { user, db } = renderApp('/settings');
    const group = await screen.findByRole('group', { name: 'Lean to my taste' });
    await user.click(within(group).getByRole('radio', { name: 'Off' }));
    await waitFor(async () => expect((await db.settings.get('taste'))?.value).toBe('off'));
  });
});
