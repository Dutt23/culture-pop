import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createRepositories } from '../../data/repositories';
import { createTestDatabase, renderApp } from '../../test/renderApp';

const jsonFile = (text: string) => new File([text], 'backup.json', { type: 'application/json' });

describe('settings: backup', () => {
  it('says plainly when the chosen file is not a backup', async () => {
    const { user } = renderApp('/settings');

    await user.upload(await screen.findByLabelText('Restore from a backup file'), jsonFile('{}'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This file isn't a Pop Culture Decoder backup.",
    );
  });

  it('restores favourites and settings from a backup file, shown at once', async () => {
    const source = createTestDatabase();
    await source.open();
    const repos = createRepositories(source);
    await repos.favourites.toggle('ok-boomer');
    await repos.settings.set('spoilers', 'show');
    const text = JSON.stringify(await repos.backup.create(new Date()));
    source.close();

    const { user, db } = renderApp('/settings');
    await user.upload(await screen.findByLabelText('Restore from a backup file'), jsonFile(text));

    expect(await screen.findByText(/^Backup restored/)).toHaveAttribute('role', 'status');
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Show automatically' })).toBeChecked(),
    );
    expect((await createRepositories(db).favourites.list()).map((f) => f.referenceId)).toEqual([
      'ok-boomer',
    ]);
  });
});
