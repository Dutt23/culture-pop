/**
 * Asks the browser to keep this site's storage. Without it Chromium may evict the whole origin
 * under disk pressure, all at once: the model cache and the user's favourites, history and saved
 * results in IndexedDB together. Called only after an explicit user action (a finished model
 * download the user agreed to, the first favourite), never on page load.
 */

export type PersistOutcome = 'unsupported' | 'already' | 'granted' | 'denied';

/** The Storage API members used here, so tests can pass a stand-in. */
export interface StorageManagerLike {
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
  estimate?(): Promise<{ usage?: number; quota?: number }>;
}

function storageManager(): StorageManagerLike | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage;
}

/** Never throws: a refusal or a missing API only means storage stays best-effort. */
export async function requestPersistentStorage(
  storage: StorageManagerLike | undefined = storageManager(),
): Promise<PersistOutcome> {
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  try {
    if (await storage.persisted()) return 'already';
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export interface StorageEstimate {
  usage: number;
  quota: number;
}

/** Usage and quota for this site, or undefined where the browser doesn't say. */
export async function storageEstimate(
  storage: StorageManagerLike | undefined = storageManager(),
): Promise<StorageEstimate | undefined> {
  try {
    const estimate = await storage?.estimate?.();
    return estimate?.usage !== undefined && estimate.quota !== undefined
      ? { usage: estimate.usage, quota: estimate.quota }
      : undefined;
  } catch {
    return undefined;
  }
}
