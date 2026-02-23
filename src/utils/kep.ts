import type { Kep } from '../types/kep';

const STALE_STATUSES = new Set(['provisional', 'implementable']);
const STALE_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
export const RECENT_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

/**
 * Returns the best available date for a KEP (last-updated, then creation-date).
 */
export function getKepDate(kep: Kep): Date | null {
  const str = kep['last-updated'] ?? kep['creation-date'];
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Returns the number of whole days between now and the given date (positive = past).
 */
export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Returns KEPs updated within the last 30 days, sorted by recency.
 */
export function getRecentKeps(keps: Kep[], limit = 10): { kep: Kep; date: Date }[] {
  const cutoff = Date.now() - RECENT_THRESHOLD_MS;
  return keps
    .map((kep) => ({ kep, date: getKepDate(kep) }))
    .filter((item): item is { kep: Kep; date: Date } => item.date !== null && item.date.getTime() >= cutoff)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, limit);
}
