import { useState, useEffect } from 'react';
import type { GitChange } from '../api/shared';

export interface UseRecentChangesResult {
  changes: GitChange[];
  loading: boolean;
}

export function useRecentChanges(fetchChanges: () => Promise<GitChange[]>): UseRecentChangesResult {
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchChanges();
        if (!cancelled) {
          setChanges(data);
        }
      } catch {
        // ignore errors; fall back to empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchChanges]);

  return { changes, loading };
}
