import { useState, useEffect } from 'react';
import { fetchRecentlyChangedKeps, CACHE_KEY_KEP_GIT } from '../api/github';
import type { GitChange } from '../api/github';

export interface UseRecentKepChangesResult {
  changes: GitChange[];
  loading: boolean;
}

export function useRecentKepChanges(): UseRecentKepChangesResult {
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchRecentlyChangedKeps();
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
  }, []);

  return { changes, loading };
}

export { CACHE_KEY_KEP_GIT };
