import { useState, useCallback } from 'react';
import type { SortDir } from '../utils/kep';

export interface UseSortResult<K extends string> {
  sortKey: K | undefined;
  sortDir: SortDir;
  handleSort: (key: K) => void;
}

/** Column sort state: selecting the active column flips direction, a new column sorts ascending. */
export function useSort<K extends string>(): UseSortResult<K> {
  const [sort, setSort] = useState<{ key: K | undefined; dir: SortDir }>({ key: undefined, dir: 'asc' });

  const handleSort = useCallback((key: K) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }, []);

  return { sortKey: sort.key, sortDir: sort.dir, handleSort };
}
