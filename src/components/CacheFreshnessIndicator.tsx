'use client';

import { useSyncExternalStore } from 'react';
import { CACHE_KEY_KEPS } from '../api/github';
import { CACHE_KEY_GEPS } from '../api/gatewayapi';
import { CACHE_CHANGE_EVENT, clearCache, getCacheTimestamp } from '../api/shared';

const CACHE_KEYS = [CACHE_KEY_KEPS, CACHE_KEY_GEPS];
const MINUTE_MS = 60_000;

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CACHE_CHANGE_EVENT, onChange);
  // Other tabs writing the cache.
  window.addEventListener('storage', onChange);
  const interval = setInterval(onChange, MINUTE_MS);
  return () => {
    window.removeEventListener(CACHE_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
    clearInterval(interval);
  };
}

/**
 * Whole minutes since the oldest cached list was fetched, or null when nothing
 * is cached. Rounded to minutes so the snapshot only changes once a minute.
 */
function getMinutesSinceSync(): number | null {
  const timestamps = CACHE_KEYS.map(getCacheTimestamp).filter((t): t is number => t !== null);
  if (timestamps.length === 0) return null;
  return Math.max(0, Math.floor((Date.now() - Math.min(...timestamps)) / MINUTE_MS));
}

// Nothing is known about the cache while prerendering; render nothing so the
// server HTML matches the first client render.
function getServerSnapshot(): null {
  return null;
}

function formatTimeAgo(minutes: number): string {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function CacheFreshnessIndicator() {
  const minutes = useSyncExternalStore(subscribe, getMinutesSinceSync, getServerSnapshot);

  function handleRefresh() {
    clearCache(...CACHE_KEYS);
    window.location.reload();
  }

  if (minutes === null) return null;

  return (
    <span className="cache-freshness">
      <span className="cache-freshness-label">Last synced: {formatTimeAgo(minutes)}</span>
      <button
        className="cache-refresh-btn"
        onClick={handleRefresh}
        aria-label="Refresh data"
        title="Refresh data"
      >
        ↻
      </button>
    </span>
  );
}
