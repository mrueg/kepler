import { useState, useEffect, useCallback } from 'react';
import { fetchAllGeps, CACHE_KEY_GEPS, CACHE_KEY_GEP_TREE } from '../api/gatewayapi';
import type { Gep } from '../types/gep';

export interface UseGepsResult {
  geps: Gep[];
  loading: boolean;
  progress: { loaded: number; total: number };
  error: string | null;
  reload: () => void;
}

export function useGeps(): UseGepsResult {
  const [geps, setGeps] = useState<Gep[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setGeps([]);
      setProgress({ loaded: 0, total: 0 });

      try {
        const data = await fetchAllGeps((loaded, total) => {
          if (!cancelled) {
            setProgress({ loaded, total });
          }
        });
        if (!cancelled) {
          setGeps(data);
          setProgress({ loaded: data.length, total: data.length });
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load GEPs');
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
    localStorage.removeItem(CACHE_KEY_GEPS);
    localStorage.removeItem(CACHE_KEY_GEP_TREE);
    setVersion((v) => v + 1);
  }, []);

  return { geps, loading, progress, error, reload };
}
