import yaml from 'js-yaml';
import type { Kep, KepMetadata } from '../types/kep';

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/kubernetes/enhancements/master';
const GITHUB_API_BASE = 'https://api.github.com';
const CACHE_KEY_KEPS = 'kepler_keps_v2';
const CACHE_KEY_TREE = 'kepler_tree_v2';
const CACHE_TTL_TREE = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_KEPS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_CHANGELOG_COMMITS = 10;
const MAX_COMMIT_MESSAGE_LENGTH = 120;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getCached<T>(key: string, ttl: number): T | null {
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

function setCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage might be full
  }
}

export function parseKepPath(
  path: string,
): { sig: string; number: string; slug: string } | null {
  const match = path.match(/^keps\/(sig-[^/]+)\/(\d+)-([^/]+)\/kep\.yaml$/);
  if (!match) return null;
  return { sig: match[1], number: match[2], slug: match[3] };
}

export async function fetchKepPaths(): Promise<string[]> {
  const cached = getCached<string[]>(CACHE_KEY_TREE, CACHE_TTL_TREE);
  if (cached) return cached;

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/kubernetes/enhancements/git/trees/HEAD?recursive=1`,
  );
  if (!response.ok)
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`,
    );

  const data = (await response.json()) as {
    tree: { path: string; type: string }[];
  };
  const paths = data.tree
    .filter(
      (item) =>
        item.type === 'blob' &&
        /^keps\/sig-[^/]+\/\d+-[^/]+\/kep\.yaml$/.test(item.path),
    )
    .map((item) => item.path);

  setCache(CACHE_KEY_TREE, paths);
  return paths;
}

export async function fetchKepYaml(path: string): Promise<Kep> {
  const response = await fetch(`${GITHUB_RAW_BASE}/${path}`);
  if (!response.ok)
    throw new Error(`Failed to fetch ${path}: ${response.status}`);

  const text = await response.text();
  const metadata = (yaml.load(text) as KepMetadata) || {};
  const pathInfo = parseKepPath(path)!;
  const dirPath = path.replace('/kep.yaml', '');

  return {
    ...metadata,
    path,
    ...pathInfo,
    title: metadata.title || `KEP-${pathInfo.number}`,
    githubUrl: `https://github.com/kubernetes/enhancements/tree/master/${dirPath}`,
  };
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

export async function fetchEnhancementPRs(
  kepNumber: string,
): Promise<PRInfo[]> {
  try {
    const searchUrl = `${GITHUB_API_BASE}/search/issues?q=repo:kubernetes/enhancements+is:pr+${encodeURIComponent(kepNumber)}&per_page=5&sort=updated&order=desc`;
    const searchResp = await fetch(searchUrl);
    if (!searchResp.ok) return [];
    const searchData = (await searchResp.json()) as {
      items: { number: number; title: string; state: string; html_url: string; pull_request?: { merged_at: string | null }; draft?: boolean; user: { login: string } }[];
    };

    const kepNumberLower = kepNumber.toLowerCase();
    const prs = searchData.items.filter((item) =>
      item.title.toLowerCase().includes(kepNumberLower) ||
      item.title.toLowerCase().includes(`kep-${kepNumberLower}`)
    );

    const results: PRInfo[] = await Promise.all(
      prs.slice(0, 3).map(async (item) => {
        const merged_at = item.pull_request?.merged_at ?? null;
        let ciStatus: PRInfo['ciStatus'] = 'unknown';
        let reviewStatus: PRInfo['reviewStatus'] = 'none';

        try {
          const prResp = await fetch(
            `${GITHUB_API_BASE}/repos/kubernetes/enhancements/pulls/${item.number}/reviews`,
          );
          if (prResp.ok) {
            const reviews = (await prResp.json()) as { state: string; user: { login: string } }[];
            // Track the latest actionable review state per reviewer
            const latestByReviewer: Record<string, string> = {};
            for (const review of reviews) {
              if (review.state === 'APPROVED' || review.state === 'CHANGES_REQUESTED') {
                latestByReviewer[review.user.login] = review.state;
              }
            }
            const states = Object.values(latestByReviewer);
            if (states.includes('CHANGES_REQUESTED')) reviewStatus = 'changes_requested';
            else if (states.includes('APPROVED')) reviewStatus = 'approved';
            else if (reviews.length > 0 && !merged_at) reviewStatus = 'pending';
          }
        } catch {
          // ignore review fetch errors
        }

        try {
          const prDetailResp = await fetch(
            `${GITHUB_API_BASE}/repos/kubernetes/enhancements/pulls/${item.number}`,
          );
          if (prDetailResp.ok) {
            const prDetail = (await prDetailResp.json()) as { head: { sha: string } };
            const checksResp = await fetch(
              `${GITHUB_API_BASE}/repos/kubernetes/enhancements/commits/${prDetail.head.sha}/check-runs`,
            );
            if (checksResp.ok) {
              const checksData = (await checksResp.json()) as { check_runs: { conclusion: string | null; status: string }[] };
              const runs = checksData.check_runs;
              if (runs.length === 0) {
                ciStatus = 'unknown';
              } else if (runs.some((r) => r.status !== 'completed')) {
                ciStatus = 'pending';
              } else if (runs.every((r) => r.conclusion === 'success' || r.conclusion === 'skipped' || r.conclusion === 'neutral')) {
                ciStatus = 'success';
              } else {
                ciStatus = 'failure';
              }
            }
          }
        } catch {
          // ignore CI fetch errors
        }

        return {
          number: item.number,
          title: item.title,
          state: (item.state === 'open' || item.state === 'closed') ? item.state : 'closed',
          html_url: item.html_url,
          draft: item.draft ?? false,
          merged_at,
          user: item.user,
          ciStatus,
          reviewStatus,
        };
      }),
    );

    return results;
  } catch {
    return [];
  }
}

export interface ChangelogEntry {
  sha: string;
  date: string;
  author: string;
  message: string;
  status: string;
}

export async function fetchKepChangelog(kepPath: string): Promise<ChangelogEntry[]> {
  try {
    const commitsUrl = `${GITHUB_API_BASE}/repos/kubernetes/enhancements/commits?path=${encodeURIComponent(kepPath)}&per_page=${MAX_CHANGELOG_COMMITS}`;
    const resp = await fetch(commitsUrl);
    if (!resp.ok) return [];

    const commits = (await resp.json()) as {
      sha: string;
      commit: { message: string; author: { date: string; name: string } };
      author: { login: string } | null;
    }[];

    if (!commits.length) return [];

    const entries = await Promise.allSettled(
      commits.map(async (commit) => {
        const rawUrl = `https://raw.githubusercontent.com/kubernetes/enhancements/${commit.sha}/${kepPath}`;
        const contentResp = await fetch(rawUrl);
        let status = '';
        if (contentResp.ok) {
          const text = await contentResp.text();
          const match = text.match(/^status:\s*(.+)$/m);
          if (match) status = match[1].trim();
        }
        return {
          sha: commit.sha,
          date: commit.commit.author.date,
          author: commit.author?.login ?? commit.commit.author.name,
          message: commit.commit.message.split('\n')[0].slice(0, MAX_COMMIT_MESSAGE_LENGTH),
          status,
        };
      }),
    );

    const results = entries
      .filter(
        (e): e is PromiseFulfilledResult<ChangelogEntry> =>
          e.status === 'fulfilled',
      )
      .map((e) => e.value);

    // Filter to entries where status changed (oldest→newest, then reverse for display)
    const statusChanges: ChangelogEntry[] = [];
    let prevStatus = '';
    for (const entry of [...results].reverse()) {
      if (entry.status && entry.status !== prevStatus) {
        statusChanges.unshift(entry);
        prevStatus = entry.status;
      }
    }

    return statusChanges.length > 0 ? statusChanges : results.filter((e) => e.status);
  } catch {
    return [];
  }
}

export async function fetchKepReadme(kepPath: string): Promise<string | null> {
  const dirPath = kepPath.slice(0, kepPath.lastIndexOf('/'));
  const readmeUrl = `${GITHUB_RAW_BASE}/${dirPath}/README.md`;
  try {
    const response = await fetch(readmeUrl);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function fetchAllKeps(
  onProgress?: (loaded: number, total: number) => void,
): Promise<Kep[]> {
  const cached = getCached<Kep[]>(CACHE_KEY_KEPS, CACHE_TTL_KEPS);
  if (cached) {
    onProgress?.(cached.length, cached.length);
    return cached;
  }

  const paths = await fetchKepPaths();
  const validPaths = paths.filter((p) => parseKepPath(p) !== null);
  const total = validPaths.length;
  const results: Kep[] = [];
  const CONCURRENCY = 15;

  for (let i = 0; i < validPaths.length; i += CONCURRENCY) {
    const batch = validPaths.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((path) => fetchKepYaml(path)),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }

    onProgress?.(Math.min(i + CONCURRENCY, total), total);
  }

  results.sort((a, b) => Number(b.number) - Number(a.number));
  setCache(CACHE_KEY_KEPS, results);
  return results;
}
