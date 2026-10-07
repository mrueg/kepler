import { load as yamlLoad } from 'js-yaml';
import type { Gep, GepMetadata } from '../types/gep';
import { githubFetch } from '../utils/githubFetch';
import {
  GITHUB_API_BASE,
  getCached,
  setCache,
  fetchTreePaths,
  fetchAllBatched,
  fetchText,
  fetchRecentlyChanged,
  fetchReviewStatus,
  fetchCIStatus,
  normalizePRState,
  type GitChange,
  type PRInfo,
} from './shared';

const REPO = 'kubernetes-sigs/gateway-api';
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main`;
export const CACHE_KEY_GEPS = 'kepler_geps_v2';
export const CACHE_KEY_GEP_TREE = 'kepler_gep_tree_v1';
const CACHE_KEY_GEP_GIT = 'kepler_gep_git_v1';
const CACHE_TTL_TREE = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_GEPS = 6 * 60 * 60 * 1000; // 6 hours

const GEP_PATH_PATTERN = /^geps\/gep-(\d+)\/metadata\.yaml$/;
// Matches GEP file paths like: geps/gep-<number>/...
const GEP_FILE_PATTERN = /^geps\/gep-(\d+)\//;

export function parseGepPath(path: string): { number: string } | null {
  const match = path.match(GEP_PATH_PATTERN);
  if (!match) return null;
  return { number: match[1] };
}

export function buildGepPath(number: string): string {
  return `geps/gep-${number}/metadata.yaml`;
}

export function fetchGepPaths(): Promise<string[]> {
  return fetchTreePaths(REPO, GEP_PATH_PATTERN, CACHE_KEY_GEP_TREE, CACHE_TTL_TREE);
}

export async function fetchGepYaml(path: string): Promise<Gep> {
  const [response, content] = await Promise.all([
    githubFetch(`${GITHUB_RAW_BASE}/${path}`),
    fetchText(`${GITHUB_RAW_BASE}/${path.replace('/metadata.yaml', '/index.md')}`),
  ]);
  if (!response.ok)
    throw new Error(`Failed to fetch ${path}: ${response.status}`);

  const text = await response.text();

  const metadata = yamlLoad(text) as GepMetadata | null;
  if (!metadata || typeof metadata.number === 'undefined' || !metadata.name) {
    throw new Error(`Invalid GEP metadata at ${path}`);
  }
  const dirPath = path.replace('/metadata.yaml', '');

  return {
    ...metadata,
    path,
    githubUrl: `https://github.com/${REPO}/tree/main/${dirPath}`,
    ...(content !== null ? { content } : {}),
  };
}

export function fetchGepContent(gepPath: string): Promise<string | null> {
  const dirPath = gepPath.slice(0, gepPath.lastIndexOf('/'));
  return fetchText(`${GITHUB_RAW_BASE}/${dirPath}/index.md`);
}

/**
 * Returns the last `limit` GEPs changed in git history, most-recent first.
 */
export function fetchRecentlyChangedGeps(limit = 10): Promise<GitChange[]> {
  return fetchRecentlyChanged(REPO, 'geps/', GEP_FILE_PATTERN, CACHE_KEY_GEP_GIT, limit);
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
  const results = await fetchAllBatched(paths, fetchGepYaml, onProgress);

  results.sort((a, b) => Number(b.number) - Number(a.number));
  // Strip content before caching to avoid exceeding localStorage size limits
  const gepsToCache = results.map(({ content: _content, ...gep }) => gep);
  setCache(CACHE_KEY_GEPS, gepsToCache);
  return results;
}

/**
 * Fetch live PR state/CI/review status for a list of gateway-api PR URLs.
 * Each URL is expected to look like:
 *   https://github.com/kubernetes-sigs/gateway-api/pull/<number>
 */
export async function fetchGatewayApiPRs(
  changelogUrls: string[],
): Promise<PRInfo[]> {
  const prNumbers = changelogUrls
    .map((url) => {
      const m = url.match(/kubernetes-sigs\/gateway-api\/pull\/(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n): n is number => n !== null);

  return Promise.all(
    prNumbers.map(async (prNum): Promise<PRInfo> => {
      const info: PRInfo = {
        number: prNum,
        title: `PR #${prNum}`,
        state: 'closed',
        html_url: `https://github.com/${REPO}/pull/${prNum}`,
        draft: false,
        merged_at: null,
        user: { login: '' },
        ciStatus: 'unknown',
        reviewStatus: 'none',
      };

      try {
        const prResp = await githubFetch(`${GITHUB_API_BASE}/repos/${REPO}/pulls/${prNum}`);
        if (prResp.ok) {
          const pr = (await prResp.json()) as {
            title: string;
            state: string;
            draft: boolean;
            merged_at: string | null;
            user: { login: string };
            head: { sha: string };
          };
          info.title = pr.title;
          info.state = normalizePRState(pr.state);
          info.draft = pr.draft ?? false;
          info.merged_at = pr.merged_at;
          info.user = pr.user;
          [info.reviewStatus, info.ciStatus] = await Promise.all([
            fetchReviewStatus(REPO, prNum, pr.merged_at !== null),
            fetchCIStatus(REPO, pr.head.sha),
          ]);
        } else {
          // PR might be closed — try issues endpoint for merged PRs
          const issueResp = await githubFetch(`${GITHUB_API_BASE}/repos/${REPO}/issues/${prNum}`);
          if (issueResp.ok) {
            const issue = (await issueResp.json()) as {
              title: string;
              user: { login: string };
              pull_request?: { merged_at: string | null };
            };
            info.title = issue.title;
            info.merged_at = issue.pull_request?.merged_at ?? null;
            info.user = issue.user;
          }
        }
      } catch {
        // ignore
      }

      return info;
    }),
  );
}
