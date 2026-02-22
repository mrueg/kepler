import { useState, useEffect, useCallback } from 'react';
import { fetchAllKeps } from '../api/github';
import type { Kep } from '../types/kep';

export interface UseKepsResult {
  keps: Kep[];
  loading: boolean;
  progress: { loaded: number; total: number };
  error: string | null;
  reload: () => void;
}

export function useKeps(): UseKepsResult {
  const [keps, setKeps] = useState<Kep[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setKeps([]);
      setProgress({ loaded: 0, total: 0 });

      try {
        const data = await fetchAllKeps((loaded, total) => {
          if (!cancelled) {
            setProgress({ loaded, total });
            // Update keps progressively as they load
          }
        });
        if (!cancelled) {
          setKeps(data);
          setProgress({ loaded: data.length, total: data.length });
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load KEPs');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => {
    // Clear cache
    localStorage.removeItem('kepler_keps_v3');
    localStorage.removeItem('kepler_tree_v2');
    setVersion((v) => v + 1);
  }, []);

  return { keps, loading, progress, error, reload };
}
