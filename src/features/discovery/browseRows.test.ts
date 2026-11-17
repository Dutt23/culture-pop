import { describe, expect, it } from 'vitest';
import { makeReference } from '../../test/factories';
import { browseRows, columnsFor, type BrowseGroup } from './browseRows';

const refs = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => makeReference(`${prefix}${i}`, `${prefix} ${i}`));

const titlesOf = (references: readonly { title: string }[]) => references.map((r) => r.title);

describe('browseRows', () => {
  const groups: BrowseGroup[] = [
    { key: '1990s', title: '1990s', references: refs('a', 5) },
    { key: '2000s', title: '2000s', references: refs('b', 2) },
  ];

  it('puts each heading before its cards, and fills rows left to right with a short last row', () => {
    const rows = browseRows(groups, 2);
    expect(
      rows.map((row) => (row.kind === 'heading' ? row.title : titlesOf(row.references))),
    ).toEqual(['1990s', ['a 0', 'a 1'], ['a 2', 'a 3'], ['a 4'], '2000s', ['b 0', 'b 1']]);
  });

  it("marks where each row of cards starts in its group, and the group's size", () => {
    const rows = browseRows(groups, 2).flatMap((row) =>
      row.kind === 'cards' ? [[row.start, row.total]] : [],
    );
    expect(rows).toEqual([
      [0, 5],
      [2, 5],
      [4, 5],
      [0, 2],
    ]);
  });

  it('gives every row its own key', () => {
    const keys = browseRows(groups, 2).map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps a heading for an empty group, and treats zero columns as one', () => {
    const rows = browseRows([{ key: 'x', title: 'Empty', references: [] }, groups[1]], 0);
    expect(rows.map((row) => row.kind)).toEqual(['heading', 'heading', 'cards', 'cards']);
  });
});

describe('columnsFor', () => {
  it('fits as many minimum-width cards as the width allows, counting the gaps', () => {
    expect(columnsFor(240, 240, 12)).toBe(1);
    expect(columnsFor(491, 240, 12)).toBe(1);
    expect(columnsFor(492, 240, 12)).toBe(2);
    expect(columnsFor(1216, 240, 12)).toBe(4);
  });

  it('never goes below one column, even before the list has a width', () => {
    expect(columnsFor(0, 240, 12)).toBe(1);
    expect(columnsFor(100, 240, 12)).toBe(1);
  });
});
