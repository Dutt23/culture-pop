import type { Reference } from './types';

export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Deterministic tie-break: normalized title, then ID. Locale-independent on purpose. */
export function compareReferences(a: Reference, b: Reference): number {
  return compareStrings(a.normalizedTitle, b.normalizedTitle) || compareStrings(a.id, b.id);
}
