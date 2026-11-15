const BLOCKED = new Set(['MissingAPIError', 'InvalidStateError', 'SecurityError']);

function errorName(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name: unknown }).name)
    : undefined;
}

function innerError(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'inner' in error
    ? (error as { inner: unknown }).inner
    : undefined;
}

/** Plain-language message for an IndexedDB/Dexie open failure. Never implies data was deleted. */
export function describeStorageError(error: unknown): string {
  const name = errorName(error);
  const inner = innerError(error);
  if (name === 'OpenFailedError' && inner) return describeStorageError(inner);
  if (name === 'VersionError') {
    return 'Your saved data comes from a newer version of this app. Reload to get the latest version.';
  }
  if (name === 'UpgradeError') {
    return "We couldn't upgrade your saved data. Nothing was deleted — reload to try again.";
  }
  if (name === 'QuotaExceededError') {
    return 'Your device is out of storage space for this app. Free up space and reload.';
  }
  if (name && BLOCKED.has(name)) {
    return 'This browser is blocking local storage (private browsing can do this). The app needs it to keep favourites and settings.';
  }
  return 'Local storage failed to open. Reload to try again.';
}
