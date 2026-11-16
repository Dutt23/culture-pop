// en-GB has no serial comma: "A, B and C", matching the rest of the copy.
const LIST_FORMAT = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' });

/** "A", "A and B", "A, B and C". */
export function listOf(names: readonly string[]): string {
  return LIST_FORMAT.format(names);
}
