import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';
import { requestPersistentStorage, storageEstimate } from './persistentStorage';

describe('requestPersistentStorage', () => {
  it('reports a missing API instead of failing', async () => {
    expect(await requestPersistentStorage(undefined)).toBe('unsupported');
    expect(await requestPersistentStorage({})).toBe('unsupported');
  });

  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn(async () => true);
    expect(await requestPersistentStorage({ persisted: async () => true, persist })).toBe(
      'already',
    );
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns the browser answer, and never throws', async () => {
    expect(
      await requestPersistentStorage({ persisted: async () => false, persist: async () => true }),
    ).toBe('granted');
    expect(
      await requestPersistentStorage({ persisted: async () => false, persist: async () => false }),
    ).toBe('denied');
    expect(
      await requestPersistentStorage({
        persisted: async () => false,
        persist: () => Promise.reject(new Error('x')),
      }),
    ).toBe('denied');
  });

  it('gives usage and quota only when the browser states both', async () => {
    expect(await storageEstimate({ estimate: async () => ({ usage: 10, quota: 100 }) })).toEqual({
      usage: 10,
      quota: 100,
    });
    expect(await storageEstimate({ estimate: async () => ({ usage: 10 }) })).toBeUndefined();
    expect(await storageEstimate(undefined)).toBeUndefined();
  });
});

describe('when the app asks for persistent storage', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'storage');
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'storage', original);
    else Reflect.deleteProperty(navigator, 'storage');
  });

  function spyOnStorage() {
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: async () => false,
        persist,
        estimate: async () => ({ usage: 0, quota: 1 }),
      },
    });
    return persist;
  }

  it('never asks on page load', async () => {
    const persist = spyOnStorage();
    renderApp('/discover');
    await screen.findByRole('heading', { level: 1 });
    expect(persist).not.toHaveBeenCalled();
  });

  it('asks once the user saves a first favourite', async () => {
    const persist = spyOnStorage();
    const { user } = renderApp('/references/doh-simpsons');
    await user.click(await screen.findByRole('button', { name: 'Favourite' }));
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
  });
});
