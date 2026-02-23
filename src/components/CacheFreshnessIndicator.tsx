'use client';

import { useCallback, useSyncExternalStore, useState } from 'react';
import { CACHE_KEY_KEPS } from '../api/github';
import { CACHE_KEY_GEPS } from '../api/gatewayapi';

const CACHE_KEYS = [CACHE_KEY_KEPS, CACHE_KEY_GEPS];

function getElapsedMs(): number | null {
  try {
    const timestamps: number[] = [];
    for (const key of CACHE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const entry = JSON.parse(raw) as { timestamp?: number };
        if (typeof entry.timestamp === 'number') {
          timestamps.push(entry.timestamp);
        }
      }
    }
    if (timestamps.length === 0) return null;
    return Date.now() - Math.min(...timestamps);
  } catch {
    return null;
  }
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(callback: () => void): () => void {
  const interval = setInterval(callback, 60_000);
  return () => clearInterval(interval);
}

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CacheFreshnessIndicator() {
  const elapsedMs = useSyncExternalStore(subscribe, getElapsedMs, getServerSnapshot);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    try {
      setRefreshing(true);
      for (const key of CACHE_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
    // Small delay so the disabled state renders before the page reloads
    setTimeout(() => window.location.reload(), 50);
  }, []);

  if (elapsedMs === null) return null;

  return (
    <span className="cache-freshness">
      <span className="cache-freshness-label">Last synced: {formatTimeAgo(elapsedMs)}</span>
      <button
        className="cache-refresh-btn"
        onClick={handleRefresh}
        disabled={refreshing}
        aria-label="Refresh data"
        title="Refresh data"
      >
        ↻
      </button>
    </span>
  );
}
