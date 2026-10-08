import type { SortDir } from './kep';

export type ViewMode = 'grid' | 'table';

/** List display state kept in the URL so it survives navigation and can be shared. */
export interface ListDisplayState<K extends string> {
  viewMode: ViewMode;
  sortKey: K | undefined;
  sortDir: SortDir;
}

type ReadableParams = Pick<URLSearchParams, 'get'>;

export function readListDisplayState<K extends string>(
  params: ReadableParams,
  sortKeys: readonly K[],
): ListDisplayState<K> {
  const sort = params.get('sort');
  return {
    viewMode: params.get('view') === 'table' ? 'table' : 'grid',
    sortKey: sortKeys.find((k) => k === sort),
    sortDir: params.get('dir') === 'desc' ? 'desc' : 'asc',
  };
}

/** Writes non-default display state into `params` and removes defaults. */
export function writeListDisplayState<K extends string>(
  params: URLSearchParams,
  { viewMode, sortKey, sortDir }: ListDisplayState<K>,
): void {
  if (viewMode === 'table') params.set('view', 'table');
  else params.delete('view');
  if (sortKey) params.set('sort', sortKey);
  else params.delete('sort');
  if (sortKey && sortDir === 'desc') params.set('dir', 'desc');
  else params.delete('dir');
}
