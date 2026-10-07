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

export function setCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage might be full
  }
}

export function clearCache(...keys: string[]): void {
  try {
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // ignore
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

/**
 * Returns the last `limit` proposals changed in git history under `path`,
 * most-recent first. `filePattern` must capture the proposal number.
 */
export async function fetchRecentlyChanged(
  repo: string,
  path: string,
  filePattern: RegExp,
  cacheKey: string,
  limit = 10,
): Promise<GitChange[]> {
  const cached = getCached<{ number: string; date: string }[]>(cacheKey, CACHE_TTL_GIT);
  if (cached) return cached.map((c) => ({ number: c.number, date: new Date(c.date) }));

  const commitsResp = await githubFetch(
    `${GITHUB_API_BASE}/repos/${repo}/commits?path=${path}&per_page=100`,
  );
  if (!commitsResp.ok) return [];

  const commits = (await commitsResp.json()) as Array<{
    sha: string;
    commit: { author: { date: string } };
  }>;

  const seen = new Set<string>();
  const results: GitChange[] = [];
  const CONCURRENCY = 10;

  for (let i = 0; i < commits.length && results.length < limit; i += CONCURRENCY) {
    const batch = commits.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (c) => {
        const resp = await githubFetch(`${GITHUB_API_BASE}/repos/${repo}/commits/${c.sha}`);
        if (!resp.ok) return null;
        const data = (await resp.json()) as { files: Array<{ filename: string }> };
        return { date: new Date(c.commit.author.date), files: data.files ?? [] };
      }),
    );

    for (const result of batchResults) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const { date, files } = result.value;
      for (const file of files) {
        const match = file.filename.match(filePattern);
        if (match && !seen.has(match[1])) {
          seen.add(match[1]);
          results.push({ number: match[1], date });
          if (results.length >= limit) break;
        }
      }
      if (results.length >= limit) break;
    }
  }

  setCache(cacheKey, results.map((r) => ({ number: r.number, date: r.date.toISOString() })));
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

/** Derives an overall review status from the latest actionable review per reviewer. */
export async function fetchReviewStatus(
  repo: string,
  prNumber: number,
  merged: boolean,
): Promise<PRInfo['reviewStatus']> {
  try {
    const resp = await githubFetch(`${GITHUB_API_BASE}/repos/${repo}/pulls/${prNumber}/reviews`);
    if (!resp.ok) return 'none';
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
  } catch {
    // review status is optional
  }
  return 'none';
}

/** Derives an overall CI status from the check runs of `sha`. */
export async function fetchCIStatus(repo: string, sha: string): Promise<PRInfo['ciStatus']> {
  try {
    const resp = await githubFetch(`${GITHUB_API_BASE}/repos/${repo}/commits/${sha}/check-runs`);
    if (!resp.ok) return 'unknown';
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
    return 'unknown';
  }
}

export function normalizePRState(state: string): PRInfo['state'] {
  return state === 'open' || state === 'closed' ? state : 'closed';
}
