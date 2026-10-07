/**
 * Multi-select filter values: an empty array means "no filter" (every item
 * checked), and [NONE_SELECTED] means every item is unchecked (nothing matches).
 */
export const NONE_SELECTED = '__none__';

/** The items that should render as checked for a filter value. */
export function checkedItems(items: string[], selected: string[]): string[] {
  return selected.length === 0 ? items : selected.filter((i) => i !== NONE_SELECTED);
}

/** The new filter value after toggling `item`. */
export function toggleSelection(items: string[], selected: string[], item: string): string[] {
  const checked = checkedItems(items, selected);
  const next = checked.includes(item)
    ? checked.filter((i) => i !== item)
    : [...checked, item];
  if (next.length === items.length) return [];
  if (next.length === 0) return [NONE_SELECTED];
  return next;
}
