import yaml from 'js-yaml';
import type { Gep, GepMetadata } from '../types/gep';

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/kubernetes-sigs/gateway-api/main';
const GITHUB_API_BASE = 'https://api.github.com';
export const CACHE_KEY_GEPS = 'kepler_geps_v2';
export const CACHE_KEY_GEP_TREE = 'kepler_gep_tree_v1';
const CACHE_TTL_TREE = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_GEPS = 6 * 60 * 60 * 1000; // 6 hours

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

export function parseGepPath(path: string): { number: string } | null {
  const match = path.match(/^geps\/gep-(\d+)\/metadata\.yaml$/);
  if (!match) return null;
  return { number: match[1] };
}

export function buildGepPath(number: string): string {
  return `geps/gep-${number}/metadata.yaml`;
}

export async function fetchGepPaths(): Promise<string[]> {
  const cached = getCached<string[]>(CACHE_KEY_GEP_TREE, CACHE_TTL_TREE);
  if (cached) return cached;

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/kubernetes-sigs/gateway-api/git/trees/HEAD?recursive=1`,
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
        /^geps\/gep-\d+\/metadata\.yaml$/.test(item.path),
    )
    .map((item) => item.path);

  setCache(CACHE_KEY_GEP_TREE, paths);
  return paths;
}

export async function fetchGepYaml(path: string): Promise<Gep> {
  const [response, contentResponse] = await Promise.all([
    fetch(`${GITHUB_RAW_BASE}/${path}`),
    fetch(`${GITHUB_RAW_BASE}/${path.replace('/metadata.yaml', '/index.md')}`).catch(() => null),
  ]);
  if (!response.ok)
    throw new Error(`Failed to fetch ${path}: ${response.status}`);

  const text = await response.text();
  const content = contentResponse?.ok ? await contentResponse.text() : undefined;

  const metadata = yaml.load(text) as GepMetadata | null;
  if (!metadata || typeof metadata.number === 'undefined' || !metadata.name) {
    throw new Error(`Invalid GEP metadata at ${path}`);
  }
  const dirPath = path.replace('/metadata.yaml', '');

  return {
    ...metadata,
    path,
    githubUrl: `https://github.com/kubernetes-sigs/gateway-api/tree/main/${dirPath}`,
    ...(content !== undefined ? { content } : {}),
  };
}

export async function fetchGepContent(gepPath: string): Promise<string | null> {
  const dirPath = gepPath.slice(0, gepPath.lastIndexOf('/'));
  const contentUrl = `${GITHUB_RAW_BASE}/${dirPath}/index.md`;
  try {
    const response = await fetch(contentUrl);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function fetchAllGeps(
  onProgress?: (loaded: number, total: number) => void,
): Promise<Gep[]> {
  const cached = getCached<Gep[]>(CACHE_KEY_GEPS, CACHE_TTL_GEPS);
  if (cached) {
    onProgress?.(cached.length, cached.length);
    return cached;
  }

  const paths = await fetchGepPaths();
  const validPaths = paths.filter((p) => parseGepPath(p) !== null);
  const total = validPaths.length;
  const results: Gep[] = [];
  const CONCURRENCY = 15;

  for (let i = 0; i < validPaths.length; i += CONCURRENCY) {
    const batch = validPaths.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((path) => fetchGepYaml(path)),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }

    onProgress?.(Math.min(i + CONCURRENCY, total), total);
  }

  results.sort((a, b) => Number(b.number) - Number(a.number));
  setCache(CACHE_KEY_GEPS, results);
  return results;
}

export interface GepPRInfo {
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
 * Fetch live PR state/CI/review status for a list of gateway-api PR URLs.
 * Each URL is expected to look like:
 *   https://github.com/kubernetes-sigs/gateway-api/pull/<number>
 */
export async function fetchGatewayApiPRs(
  changelogUrls: string[],
): Promise<GepPRInfo[]> {
  const prNumbers = changelogUrls
    .map((url) => {
      const m = url.match(/kubernetes-sigs\/gateway-api\/pull\/(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n): n is number => n !== null);

  if (prNumbers.length === 0) return [];

  const results: GepPRInfo[] = await Promise.all(
    prNumbers.map(async (prNum) => {
      let title = `PR #${prNum}`;
      let state: 'open' | 'closed' = 'closed';
      let draft = false;
      let merged_at: string | null = null;
      let user = { login: '' };
      let ciStatus: GepPRInfo['ciStatus'] = 'unknown';
      let reviewStatus: GepPRInfo['reviewStatus'] = 'none';

      try {
        const prResp = await fetch(
          `${GITHUB_API_BASE}/repos/kubernetes-sigs/gateway-api/pulls/${prNum}`,
        );
        if (prResp.ok) {
          const pr = (await prResp.json()) as {
            number: number;
            title: string;
            state: string;
            html_url: string;
            draft: boolean;
            merged_at: string | null;
            user: { login: string };
            head: { sha: string };
          };
          title = pr.title;
          state = (pr.state === 'open' || pr.state === 'closed') ? pr.state : 'closed';
          draft = pr.draft ?? false;
          merged_at = pr.merged_at;
          user = pr.user;

          // Reviews
          try {
            const reviewsResp = await fetch(
              `${GITHUB_API_BASE}/repos/kubernetes-sigs/gateway-api/pulls/${prNum}/reviews`,
            );
            if (reviewsResp.ok) {
              const reviews = (await reviewsResp.json()) as { state: string; user: { login: string } }[];
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
            // optional
          }

          // CI check runs
          try {
            const checksResp = await fetch(
              `${GITHUB_API_BASE}/repos/kubernetes-sigs/gateway-api/commits/${pr.head.sha}/check-runs`,
            );
            if (checksResp.ok) {
              const checksData = (await checksResp.json()) as {
                check_runs: { conclusion: string | null; status: string }[];
              };
              const runs = checksData.check_runs;
              if (runs.length > 0) {
                if (runs.some((r) => r.status !== 'completed')) {
                  ciStatus = 'pending';
                } else if (
                  runs.every(
                    (r) =>
                      r.conclusion === 'success' ||
                      r.conclusion === 'skipped' ||
                      r.conclusion === 'neutral',
                  )
                ) {
                  ciStatus = 'success';
                } else {
                  ciStatus = 'failure';
                }
              }
            }
          } catch {
            // optional
          }
        } else {
          // PR might be closed — try issues endpoint for merged PRs
          const issueResp = await fetch(
            `${GITHUB_API_BASE}/repos/kubernetes-sigs/gateway-api/issues/${prNum}`,
          );
          if (issueResp.ok) {
            const issue = (await issueResp.json()) as {
              title: string;
              state: string;
              user: { login: string };
              pull_request?: { merged_at: string | null };
            };
            title = issue.title;
            state = 'closed';
            merged_at = issue.pull_request?.merged_at ?? null;
            user = issue.user;
          }
        }
      } catch {
        // ignore
      }

      return {
        number: prNum,
        title,
        state,
        html_url: `https://github.com/kubernetes-sigs/gateway-api/pull/${prNum}`,
        draft,
        merged_at,
        user,
        ciStatus,
        reviewStatus,
      };
    }),
  );

  return results;
}
