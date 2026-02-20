import type { Kep } from '../types/kep';

const STALE_STATUSES = new Set(['provisional', 'implementable']);
const STALE_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

/**
 * Returns true when a KEP is in a provisional or implementable state and
 * has not been updated (or created) within the last year.
 */
export function isStale(kep: Kep): boolean {
  if (!kep.status || !STALE_STATUSES.has(kep.status)) return false;
  const dateStr = kep['last-updated'] ?? kep['creation-date'];
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() > STALE_THRESHOLD_MS;
}
