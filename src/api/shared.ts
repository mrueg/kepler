import { githubFetch } from '../utils/githubFetch';

export const GITHUB_API_BASE = 'https://api.github.com';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/** Returns cached data if present and younger than `ttl`. */
export function getCached<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp < ttl) return entry.data;
  } catch {
    // ignore
  }
  return null;
}

/** Returns cached data regardless of its age. */
export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return (JSON.parse(raw) as CacheEntry<T>).data;
  } catch {
    return null;
  }
}

/** Dispatched on `window` whenever this tab writes or clears a cache entry. */
export const CACHE_CHANGE_EVENT = 'kepler-cache-change';

function notifyCacheChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CACHE_CHANGE_EVENT));
}

/** `timestamp` defaults to now; pass the data's own age, e.g. a snapshot's. */
export function setCache<T>(key: string, data: T, timestamp = Date.now()): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp }));
    notifyCacheChange();
  } catch {
    // localStorage might be full
  }
}

export function clearCache(...keys: string[]): void {
  try {
    for (const key of keys) localStorage.removeItem(key);
    notifyCacheChange();
  } catch {
    // ignore
  }
}

/** Returns when `key` was cached (ms since epoch), regardless of age. */
export function getCacheTimestamp(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { timestamp } = JSON.parse(raw) as Partial<CacheEntry<unknown>>;
    return typeof timestamp === 'number' ? timestamp : null;
  } catch {
    return null;
  }
}

/** Fetches the recursive git tree of `repo` and returns blob paths matching `pattern`. */
export async function fetchTreePaths(
  repo: string,
  pattern: RegExp,
  cacheKey: string,
  ttl: number,
): Promise<string[]> {
  const cached = getCached<string[]>(cacheKey, ttl);
  if (cached) return cached;

  const response = await githubFetch(
    `${GITHUB_API_BASE}/repos/${repo}/git/trees/HEAD?recursive=1`,
  );
  if (response.status === 403 || response.status === 429)
    throw new Error('GitHub API rate limit exceeded. Please try again later.');
  if (!response.ok)
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`,
    );

  const data = (await response.json()) as {
    tree: { path: string; type: string }[];
  };
  const paths = data.tree
    .filter((item) => item.type === 'blob' && pattern.test(item.path))
    .map((item) => item.path);

  setCache(cacheKey, paths);
  return paths;
}

/**
 * Fetches all `paths` with `fetchOne` in batches of `concurrency`, reporting
 * progress after each batch. Failed fetches are skipped.
 */
export async function fetchAllBatched<T>(
  paths: string[],
  fetchOne: (path: string) => Promise<T>,
  onProgress?: (loaded: number, total: number) => void,
  concurrency = 15,
): Promise<T[]> {
  const total = paths.length;
  const results: T[] = [];
  for (let i = 0; i < total; i += concurrency) {
    const batch = paths.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fetchOne));
    for (const result of batchResults) {
      if (result.status === 'fulfilled') results.push(result.value);
    }
    onProgress?.(Math.min(i + concurrency, total), total);
  }
  return results;
}

export async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await githubFetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export interface GitChange {
  number: string;
  date: Date;
}

const CACHE_TTL_GIT = 60 * 60 * 1000; // 1 hour
// Change sets are fetched in small parallel batches; smaller batches overshoot
// the `limit` by fewer requests once enough proposals are found.
const RECENT_CHANGES_BATCH = 5;

/**
 * Where to find recent changes:
 * - `merged-pulls`: recently merged PRs, dated by merge time. One request per
 *   PR, so it suits repos where almost every PR touches `path`.
 * - `commits`: commits filtered to `path` on GitHub's side, dated by when they
 *   landed. Suits squash-merging repos where most PRs don't touch `path`.
 */
export type RecentChangesSource = 'merged-pulls' | 'commits';

interface ChangeSet {
  date: string;
  /** API path returning the changed files: a commit, or a PR's files list. */
  filesPath: string;
}

async function listChangeSets(repo: string, path: string, source: RecentChangesSource): Promise<ChangeSet[] | null> {
  if (source === 'merged-pulls') {
    // Sorted by update time, which is never earlier than the merge time, so
    // recently merged PRs are within the first page.
    const resp = await githubFetch(
      `${GITHUB_API_BASE}/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`,
    );
    if (!resp.ok) return null;
    const pulls = (await resp.json()) as Array<{ number: number; merged_at: string | null }>;
    return pulls
      .filter((p): p is { number: number; merged_at: string } => p.merged_at !== null)
      .sort((a, b) => b.merged_at.localeCompare(a.merged_at))
      .map((p) => ({ date: p.merged_at, filesPath: `/repos/${repo}/pulls/${p.number}/files?per_page=100` }));
  }

  const resp = await githubFetch(`${GITHUB_API_BASE}/repos/${repo}/commits?path=${path}&per_page=100`);
  if (!resp.ok) return null;
  const commits = (await resp.json()) as Array<{ sha: string; commit: { committer: { date: string } } }>;
  return commits.map((c) => ({ date: c.commit.committer.date, filesPath: `/repos/${repo}/commits/${c.sha}` }));
}

async function fetchChangedFiles(filesPath: string): Promise<string[] | null> {
  try {
    const resp = await githubFetch(`${GITHUB_API_BASE}${filesPath}`);
    if (!resp.ok) return null;
    // A PR's files endpoint returns an array; a commit returns { files }.
    const data = (await resp.json()) as Array<{ filename: string }> | { files?: Array<{ filename: string }> };
    return (Array.isArray(data) ? data : data.files ?? []).map((f) => f.filename);
  } catch {
    return null;
  }
}

/**
 * Returns the last `limit` proposals changed under `path`, most-recent first.
 * `filePattern` must capture the proposal number.
 */
export async function fetchRecentlyChanged(
  repo: string,
  path: string,
  filePattern: RegExp,
  cacheKey: string,
  source: RecentChangesSource,
  limit = 10,
): Promise<GitChange[]> {
  const cached = getCached<{ number: string; date: string }[]>(cacheKey, CACHE_TTL_GIT);
  if (cached) return cached.map((c) => ({ number: c.number, date: new Date(c.date) }));

  const changeSets = await listChangeSets(repo, path, source);
  if (!changeSets) return [];

  const seen = new Set<string>();
  const results: GitChange[] = [];
  // A failed request could hide a more recent change; don't cache partial results.
  let complete = true;

  for (let i = 0; i < changeSets.length && results.length < limit; i += RECENT_CHANGES_BATCH) {
    const batch = changeSets.slice(i, i + RECENT_CHANGES_BATCH);
    const batchFiles = await Promise.all(batch.map((c) => fetchChangedFiles(c.filesPath)));

    for (const [j, files] of batchFiles.entries()) {
      if (!files) {
        complete = false;
        continue;
      }
      for (const file of files) {
        const match = file.match(filePattern);
        if (match && !seen.has(match[1]) && results.length < limit) {
          seen.add(match[1]);
          results.push({ number: match[1], date: new Date(batch[j].date) });
        }
      }
    }
  }

  if (complete) {
    setCache(cacheKey, results.map((r) => ({ number: r.number, date: r.date.toISOString() })));
  }
  return results;
}

export interface PRInfo {
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  draft: boolean;
  merged_at: string | null;
  user: { login: string };
  ciStatus: 'pending' | 'success' | 'failure' | 'unknown';
  reviewStatus: 'approved' | 'changes_requested' | 'pending' | 'none';
}

/**
 * Derives an overall review status from the latest actionable review per
 * reviewer. Returns undefined when the request fails.
 */
export async function fetchReviewStatus(
  repo: string,
  prNumber: number,
  merged: boolean,
): Promise<PRInfo['reviewStatus'] | undefined> {
  try {
    const resp = await githubFetch(`${GITHUB_API_BASE}/repos/${repo}/pulls/${prNumber}/reviews`);
    if (!resp.ok) return undefined;
    const reviews = (await resp.json()) as { state: string; user: { login: string } }[];
    const latestByReviewer: Record<string, string> = {};
    for (const review of reviews) {
      if (review.state === 'APPROVED' || review.state === 'CHANGES_REQUESTED') {
        latestByReviewer[review.user.login] = review.state;
      }
    }
    const states = Object.values(latestByReviewer);
    if (states.includes('CHANGES_REQUESTED')) return 'changes_requested';
    if (states.includes('APPROVED')) return 'approved';
    if (reviews.length > 0 && !merged) return 'pending';
    return 'none';
  } catch {
    return undefined;
  }
}

/**
 * Derives an overall CI status from the check runs of `sha`. Returns
 * undefined when the request fails.
 */
export async function fetchCIStatus(repo: string, sha: string): Promise<PRInfo['ciStatus'] | undefined> {
  try {
    const resp = await githubFetch(`${GITHUB_API_BASE}/repos/${repo}/commits/${sha}/check-runs`);
    if (!resp.ok) return undefined;
    const { check_runs: runs } = (await resp.json()) as {
      check_runs: { conclusion: string | null; status: string }[];
    };
    if (runs.length === 0) return 'unknown';
    if (runs.some((r) => r.status !== 'completed')) return 'pending';
    if (runs.every((r) => r.conclusion === 'success' || r.conclusion === 'skipped' || r.conclusion === 'neutral')) {
      return 'success';
    }
    return 'failure';
  } catch {
    return undefined;
  }
}

const PR_STATUS_CACHE_KEY = 'kepler_pr_status_v1';
const PR_STATUS_TTL = 20 * 60 * 1000; // 20 minutes

type PRStatusCache = Record<string, { data: PRInfo[]; timestamp: number }>;

export interface PRStatusResult {
  data: PRInfo[];
  /** False when any request failed, so the data may show 'none'/'unknown' wrongly. */
  complete: boolean;
}

/**
 * Caches the PR list for a proposal (`id`, e.g. "kubernetes/enhancements#753")
 * for 20 minutes, so repeat visits and arrow-key browsing don't repeat the
 * ~10 requests per detail page. Incomplete results are returned but not
 * cached; if loading fails entirely, recent stale data is used instead.
 */
export async function cachedPRStatus(id: string, load: () => Promise<PRStatusResult | null>): Promise<PRInfo[]> {
  const now = Date.now();
  const cache = readCache<PRStatusCache>(PR_STATUS_CACHE_KEY) ?? {};
  const hit = cache[id];
  if (hit && now - hit.timestamp < PR_STATUS_TTL) return hit.data;

  const result = await load();
  if (result === null) return hit?.data ?? [];
  if (!result.complete) return result.data;

  // Re-read in case another detail page wrote meanwhile, and drop expired entries.
  const latest = readCache<PRStatusCache>(PR_STATUS_CACHE_KEY) ?? {};
  const pruned = Object.fromEntries(
    Object.entries(latest).filter(([, entry]) => now - entry.timestamp < PR_STATUS_TTL),
  );
  setCache(PR_STATUS_CACHE_KEY, { ...pruned, [id]: { data: result.data, timestamp: now } });
  return result.data;
}

export function normalizePRState(state: string): PRInfo['state'] {
  return state === 'open' || state === 'closed' ? state : 'closed';
}
