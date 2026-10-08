import type { Kep, KepStage, KepStatus } from '../types/kep';

const STALE_STATUSES = new Set(['provisional', 'implementable']);
const STALE_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

export const KEP_STATUS_COLORS: Record<KepStatus, string> = {
  provisional: '#f59e0b',
  implementable: '#3b82f6',
  implemented: '#10b981',
  deferred: '#6b7280',
  rejected: '#ef4444',
  withdrawn: '#9ca3af',
  replaced: '#8b5cf6',
};

export const KEP_STAGE_COLORS: Record<KepStage, string> = {
  'pre-alpha': '#9ca3af',
  alpha: '#f59e0b',
  beta: '#3b82f6',
  stable: '#10b981',
};

/**
 * Returns true when a KEP is in a provisional or implementable state and
 * has not been updated (or created) within the last year.
 */
export function isStale(kep: Kep): boolean {
  if (!kep.status || !STALE_STATUSES.has(kep.status)) return false;
  const date = getKepDate(kep);
  if (!date) return false;
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
 * Formats a KEP date (a `YYYY-MM-DD` string, parsed as UTC midnight) without
 * shifting it into the viewer's timezone, which would show the previous day
 * west of UTC.
 */
export function formatKepDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  return date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

/**
 * Returns the number of whole days between now and the given date (positive = past).
 */
export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

/** "sig-api-machinery" → "SIG api machinery" */
export function formatSig(sig: string): string {
  return sig.replace(/^sig-/, 'SIG ').replace(/-/g, ' ');
}

export function kepDisplayTitle(kep: Kep): string {
  return kep.title || kep.slug.replace(/-/g, ' ');
}

export const KEP_SORT_KEYS = ['title', 'sig', 'status', 'stage', 'last-updated'] as const;
export type KepSortKey = (typeof KEP_SORT_KEYS)[number];
export type SortDir = 'asc' | 'desc';

function kepSortValue(kep: Kep, key: KepSortKey): string {
  switch (key) {
    case 'title': return (kep.title || kep.slug).toLowerCase();
    case 'sig': return kep.sig.toLowerCase();
    case 'status': return (kep.status ?? '').toLowerCase();
    case 'stage': return (kep.stage ?? '').toLowerCase();
    case 'last-updated': return kep['last-updated'] ?? kep['creation-date'] ?? '';
  }
}

export function sortKeps(keps: Kep[], key: KepSortKey | undefined, dir: SortDir): Kep[] {
  if (!key) return keps;
  return [...keps].sort((a, b) => {
    const cmp = kepSortValue(a, key).localeCompare(kepSortValue(b, key));
    return dir === 'asc' ? cmp : -cmp;
  });
}

/** "v1.32.0" → "1.32"; returns null for values that aren't a version. */
export function normalizeVersion(v: string | undefined): string | null {
  if (!v) return null;
  const match = v.replace(/^v/, '').match(/^(\d+\.\d+)/);
  return match ? match[1] : null;
}

function versionRank(v: string): number {
  const normalized = normalizeVersion(v);
  if (!normalized) return -1;
  const [major, minor] = normalized.split('.').map(Number);
  return major * 1000 + minor;
}

/** Ascending comparator for Kubernetes version strings like "v1.32" or "1.9". */
export function compareVersions(a: string, b: string): number {
  return versionRank(a) - versionRank(b);
}

/**
 * Lowercased text that search queries are matched against: title, number,
 * slug, authors and the README excerpt (when loaded).
 */
export function kepSearchText(kep: Kep): string {
  return [kep.title, kep.number, kep.slug, ...(kep.authors ?? []), kep.readme]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}
