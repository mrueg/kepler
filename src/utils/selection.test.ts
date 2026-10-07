import { describe, expect, it } from 'vitest';
import { NONE_SELECTED, checkedItems, toggleSelection } from './selection';

const items = ['a', 'b', 'c'];

describe('checkedItems', () => {
  it('treats an empty selection as everything checked', () => {
    expect(checkedItems(items, [])).toEqual(items);
  });

  it('treats NONE_SELECTED as nothing checked', () => {
    expect(checkedItems(items, [NONE_SELECTED])).toEqual([]);
  });
});

describe('toggleSelection', () => {
  it('unchecking one item from "all" filters to the rest', () => {
    expect(toggleSelection(items, [], 'b')).toEqual(['a', 'c']);
  });

  it('checking the last missing item clears the filter', () => {
    expect(toggleSelection(items, ['a', 'c'], 'b')).toEqual([]);
  });

  it('unchecking the last checked item filters to nothing', () => {
    expect(toggleSelection(items, ['a'], 'a')).toEqual([NONE_SELECTED]);
  });

  it('checking an item after "deselect all" selects only that item', () => {
    expect(toggleSelection(items, [NONE_SELECTED], 'b')).toEqual(['b']);
  });
});
