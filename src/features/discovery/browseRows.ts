import type { Reference } from '../../domain/types';

/** A heading (an era or a type) and the cards under it. */
export interface BrowseGroup {
  key: string;
  title: string;
  references: readonly Reference[];
}

export type BrowseRow =
  | { kind: 'heading'; key: string; title: string }
  | {
      kind: 'cards';
      key: string;
      references: readonly Reference[];
      /** Where this row starts in its group, and the group's size: a row holds only part of it. */
      start: number;
      total: number;
    };

/** The Browse list as rows: each heading, then its cards `columns` at a time. */
export function browseRows(groups: readonly BrowseGroup[], columns: number): BrowseRow[] {
  const perRow = Math.max(1, columns);
  return groups.flatMap((group) => {
    const rows: BrowseRow[] = [
      { kind: 'heading', key: `heading:${group.key}`, title: group.title },
    ];
    for (let start = 0; start < group.references.length; start += perRow) {
      rows.push({
        kind: 'cards',
        key: `cards:${group.key}:${perRow}:${start}`,
        references: group.references.slice(start, start + perRow),
        start,
        total: group.references.length,
      });
    }
    return rows;
  });
}

/** How many cards at least `cardMin` wide fit side by side in `width`, `gap` apart; at least one. */
export function columnsFor(width: number, cardMin: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (cardMin + gap)));
}
