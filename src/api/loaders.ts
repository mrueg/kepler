// Snapshot-first loaders used by the UI; see ./snapshot.ts and ./delta.ts.
import type { Kep } from '../types/kep';
import type { Gep } from '../types/gep';
import type { Caep } from '../types/caep';
import {
  CACHE_KEY_KEPS,
  KEP_BRANCH,
  KEP_FILE_PATTERN,
  KEP_REPO,
  compareKepsByNumber,
  fetchAllKeps,
  fetchKepYaml,
  fetchRecentlyChangedKeps,
  kepPathForFile,
} from './github';
import {
  CACHE_KEY_GEPS,
  GEP_BRANCH,
  GEP_FILE_PATTERN,
  GEP_REPO,
  compareGepsByNumber,
  fetchAllGeps,
  fetchGepYaml,
  fetchRecentlyChangedGeps,
  gepPathForFile,
} from './gatewayapi';
import {
  CACHE_KEY_CAEPS,
  CAEP_BRANCH,
  CAEP_FILE_PATTERN,
  CAEP_REPO,
  compareCaepsByDate,
  fetchAllCaeps,
  fetchCaep,
  fetchRecentlyChangedCaeps,
  parseCaepPath,
} from './clusterapi';
import {
  applyTrackingChangesSince,
  fetchReleaseMilestones,
  fetchTrackedEnhancements,
  pickCurrentMilestone,
  type ReleaseMilestone,
  type TrackedEnhancement,
} from './tracking';
import { readCache, setCache, type GitChange } from './shared';
import { loadSnapshot, type SnapshotName } from './snapshot';
import { applyChanges, applyRecentChanges, COMPARE_TTL_MS, fetchChangesSince, type DeltaSource } from './delta';

type OnProgress = (loaded: number, total: number) => void;

interface RepoDelta<T> extends DeltaSource<T> {
  repo: string;
  branch: string;
}

const KEP_DELTA: RepoDelta<Kep> = {
  repo: KEP_REPO,
  branch: KEP_BRANCH,
  proposalPathFor: kepPathForFile,
  fetchItem: fetchKepYaml,
  compare: compareKepsByNumber,
};
const GEP_DELTA: RepoDelta<Gep> = {
  repo: GEP_REPO,
  branch: GEP_BRANCH,
  proposalPathFor: gepPathForFile,
  fetchItem: fetchGepYaml,
  compare: compareGepsByNumber,
};
const CAEP_DELTA: RepoDelta<Caep> = {
  repo: CAEP_REPO,
  branch: CAEP_BRANCH,
  proposalPathFor: (filename) => (parseCaepPath(filename) ? filename : null),
  fetchItem: fetchCaep,
  compare: compareCaepsByDate,
};

/**
 * Returns the snapshot list, updated with changes made since it was built,
 * or fetches live without a snapshot. The result also fills the list cache
 * (without bulky text), which detail pages, quick jump and cross-references
 * read, dated to how current the data is.
 */
function snapshotFirst<T extends { path: string }>(
  name: SnapshotName,
  cacheKey: string,
  stripForCache: (item: T) => T,
  fetchLive: (onProgress?: OnProgress) => Promise<T[]>,
  delta: RepoDelta<T>,
) {
  return async (onProgress?: OnProgress): Promise<T[]> => {
    const snapshot = await loadSnapshot<T[]>(name);
    if (!snapshot) return fetchLive(onProgress);

    let items = snapshot.data;
    let asOf = Date.parse(snapshot.generatedAt);
    if (snapshot.commit) {
      const changes = await fetchChangesSince(delta.repo, snapshot.commit, delta.branch);
      // A truncated comparison can't be applied reliably; show the snapshot as-is.
      if (changes?.complete) {
        const patched = await applyChanges(items, changes.files, delta, changes.head);
        items = patched.items;
        if (patched.complete) asOf = changes.checkedAt;
      }
    }

    setCache(cacheKey, items.map(stripForCache), asOf);
    onProgress?.(items.length, items.length);
    return items;
  };
}

export const loadKeps = snapshotFirst<Kep>('keps', CACHE_KEY_KEPS, ({ readme: _readme, ...kep }) => kep, fetchAllKeps, KEP_DELTA);
export const loadGeps = snapshotFirst<Gep>('geps', CACHE_KEY_GEPS, ({ content: _content, ...gep }) => gep, fetchAllGeps, GEP_DELTA);
export const loadCaeps = snapshotFirst<Caep>('caeps', CACHE_KEY_CAEPS, ({ content: _content, ...caep }) => caep, fetchAllCaeps, CAEP_DELTA);

/** Recent changes as stored in snapshots: dates as ISO strings. */
export type SerializedGitChange = { number: string; date: string };

function recentFirst(
  name: SnapshotName,
  fetchLive: () => Promise<GitChange[]>,
  delta: { repo: string; branch: string; numberPattern: RegExp },
) {
  return async (): Promise<GitChange[]> => {
    const snapshot = await loadSnapshot<SerializedGitChange[]>(name);
    if (!snapshot) return fetchLive();
    const recent = snapshot.data.map((c) => ({ number: c.number, date: new Date(c.date) }));
    if (!snapshot.commit) return recent;
    // Shares the comparison (and its cache) with the list loader.
    const changes = await fetchChangesSince(delta.repo, snapshot.commit, delta.branch);
    if (!changes?.complete || !changes.latestCommitDate) return recent;
    return applyRecentChanges(recent, changes.files, delta.numberPattern, new Date(changes.latestCommitDate));
  };
}

export const loadRecentKepChanges = recentFirst('recent-keps', () => fetchRecentlyChangedKeps(), {
  repo: KEP_REPO,
  branch: KEP_BRANCH,
  numberPattern: KEP_FILE_PATTERN,
});
export const loadRecentCaepChanges = recentFirst('recent-caeps', () => fetchRecentlyChangedCaeps(), {
  repo: CAEP_REPO,
  branch: CAEP_BRANCH,
  // Captures the CAEP id, which What's New uses in place of a number.
  numberPattern: CAEP_FILE_PATTERN,
});
export const loadRecentGepChanges = recentFirst('recent-geps', () => fetchRecentlyChangedGeps(), {
  repo: GEP_REPO,
  branch: GEP_BRANCH,
  numberPattern: GEP_FILE_PATTERN,
});

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

const TRACKING_DELTA_CACHE_KEY = 'kepler_tracking_delta_v1';

/** The snapshot updated with tracking issues changed since it was built (cached 10 minutes). */
export async function loadReleaseTracking(): Promise<ReleaseTracking> {
  const snapshot = await loadSnapshot<ReleaseTracking>('release-tracking');
  if (!snapshot) return fetchReleaseTracking();

  const cached = readCache<{ since: string; checkedAt: number; data: ReleaseTracking }>(TRACKING_DELTA_CACHE_KEY);
  if (cached && cached.since === snapshot.generatedAt && Date.now() - cached.checkedAt < COMPARE_TTL_MS) {
    return cached.data;
  }
  try {
    const items = await applyTrackingChangesSince(snapshot.data.milestone, snapshot.data.items, snapshot.generatedAt);
    if (!items) return snapshot.data;
    const data = { milestone: snapshot.data.milestone, items };
    setCache(TRACKING_DELTA_CACHE_KEY, { since: snapshot.generatedAt, checkedAt: Date.now(), data });
    return data;
  } catch {
    return snapshot.data;
  }
}
