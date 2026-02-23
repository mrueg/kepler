import { useState, useEffect } from 'react';
import { fetchRecentlyChangedGeps, CACHE_KEY_GEP_GIT } from '../api/gatewayapi';
import type { GitChange } from '../api/gatewayapi';

export interface UseRecentGepChangesResult {
  changes: GitChange[];
  loading: boolean;
}

export function useRecentGepChanges(): UseRecentGepChangesResult {
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchRecentlyChangedGeps();
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

export { CACHE_KEY_GEP_GIT };
