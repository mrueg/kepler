import { useState, useEffect, useCallback } from 'react';
import { CACHE_KEY_KEPS, CACHE_KEY_TREE } from '../api/github';
import { CACHE_KEY_GEPS, CACHE_KEY_GEP_TREE } from '../api/gatewayapi';
import { CACHE_KEY_CAEPS, CACHE_KEY_CAEP_TREE } from '../api/clusterapi';
import { loadCaeps, loadGeps, loadKeps } from '../api/loaders';
import { clearCache } from '../api/shared';
import type { Kep } from '../types/kep';
import type { Gep } from '../types/gep';
import type { Caep } from '../types/caep';

export interface UseProposalsResult<T> {
  items: T[];
  loading: boolean;
  progress: { loaded: number; total: number };
  error: string | null;
  reload: () => void;
}

function useProposals<T>(
  fetchAll: (onProgress: (loaded: number, total: number) => void) => Promise<T[]>,
  cacheKeys: string[],
  errorMessage: string,
): UseProposalsResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setItems([]);
      setProgress({ loaded: 0, total: 0 });

      try {
        const data = await fetchAll((loaded, total) => {
          if (!cancelled) setProgress({ loaded, total });
        });
        if (!cancelled) {
          setItems(data);
          setProgress({ loaded: data.length, total: data.length });
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : errorMessage);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [version, fetchAll, errorMessage]);

  const reload = useCallback(() => {
    clearCache(...cacheKeys);
    setVersion((v) => v + 1);
  }, [cacheKeys]);

  return { items, loading, progress, error, reload };
}

const KEP_CACHE_KEYS = [CACHE_KEY_KEPS, CACHE_KEY_TREE];
const GEP_CACHE_KEYS = [CACHE_KEY_GEPS, CACHE_KEY_GEP_TREE];
const CAEP_CACHE_KEYS = [CACHE_KEY_CAEPS, CACHE_KEY_CAEP_TREE];

export function useKeps(): UseProposalsResult<Kep> {
  return useProposals(loadKeps, KEP_CACHE_KEYS, 'Failed to load KEPs');
}

export function useGeps(): UseProposalsResult<Gep> {
  return useProposals(loadGeps, GEP_CACHE_KEYS, 'Failed to load GEPs');
}

export function useCaeps(): UseProposalsResult<Caep> {
  return useProposals(loadCaeps, CAEP_CACHE_KEYS, 'Failed to load CAEPs');
}
