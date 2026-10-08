// Snapshot-first loaders used by the UI; see ./snapshot.ts.
import type { Kep } from '../types/kep';
import type { Gep } from '../types/gep';
import type { Caep } from '../types/caep';
import { CACHE_KEY_KEPS, fetchAllKeps, fetchRecentlyChangedKeps } from './github';
import { CACHE_KEY_GEPS, fetchAllGeps, fetchRecentlyChangedGeps } from './gatewayapi';
import { CACHE_KEY_CAEPS, fetchAllCaeps } from './clusterapi';
import {
  fetchReleaseMilestones,
  fetchTrackedEnhancements,
  pickCurrentMilestone,
  type ReleaseMilestone,
  type TrackedEnhancement,
} from './tracking';
import { setCache, type GitChange } from './shared';
import { loadSnapshot, type SnapshotName } from './snapshot';

type OnProgress = (loaded: number, total: number) => void;

/**
 * Returns the snapshot list if available, else fetches live. A snapshot also
 * fills the list cache (without bulky text), which detail pages, quick jump
 * and cross-references read, dated to when the snapshot was generated.
 */
function snapshotFirst<T>(
  name: SnapshotName,
  cacheKey: string,
  stripForCache: (item: T) => T,
  fetchLive: (onProgress?: OnProgress) => Promise<T[]>,
) {
  return async (onProgress?: OnProgress): Promise<T[]> => {
    const snapshot = await loadSnapshot<T[]>(name);
    if (!snapshot) return fetchLive(onProgress);
    setCache(cacheKey, snapshot.data.map(stripForCache), Date.parse(snapshot.generatedAt));
    onProgress?.(snapshot.data.length, snapshot.data.length);
    return snapshot.data;
  };
}

export const loadKeps = snapshotFirst<Kep>('keps', CACHE_KEY_KEPS, ({ readme: _readme, ...kep }) => kep, fetchAllKeps);
export const loadGeps = snapshotFirst<Gep>('geps', CACHE_KEY_GEPS, ({ content: _content, ...gep }) => gep, fetchAllGeps);
export const loadCaeps = snapshotFirst<Caep>('caeps', CACHE_KEY_CAEPS, ({ content: _content, ...caep }) => caep, fetchAllCaeps);

/** Recent changes as stored in snapshots: dates as ISO strings. */
export type SerializedGitChange = { number: string; date: string };

function recentFirst(name: SnapshotName, fetchLive: () => Promise<GitChange[]>) {
  return async (): Promise<GitChange[]> => {
    const snapshot = await loadSnapshot<SerializedGitChange[]>(name);
    if (!snapshot) return fetchLive();
    return snapshot.data.map((c) => ({ number: c.number, date: new Date(c.date) }));
  };
}

export const loadRecentKepChanges = recentFirst('recent-keps', () => fetchRecentlyChangedKeps());
export const loadRecentGepChanges = recentFirst('recent-geps', () => fetchRecentlyChangedGeps());

export interface ReleaseTracking {
  milestone: ReleaseMilestone;
  items: TrackedEnhancement[];
}

/** Enhancements opted in to the release in progress; throws if none is found. */
export async function fetchReleaseTracking(): Promise<ReleaseTracking> {
  const milestone = pickCurrentMilestone(await fetchReleaseMilestones());
  if (!milestone) throw new Error('No release milestone found.');
  return { milestone, items: await fetchTrackedEnhancements(milestone) };
}

export async function loadReleaseTracking(): Promise<ReleaseTracking> {
  return (await loadSnapshot<ReleaseTracking>('release-tracking'))?.data ?? fetchReleaseTracking();
}
