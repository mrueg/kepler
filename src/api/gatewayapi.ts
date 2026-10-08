import { load as yamlLoad } from 'js-yaml';
import type { Gep } from '../types/gep';
import { normalizeGepMetadata } from '../utils/normalize';
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
  cachedPRStatus,
  NotFoundError,
  type GitChange,
  type PRInfo,
  type PRStatusResult,
} from './shared';

const REPO = 'kubernetes-sigs/gateway-api';
export const GEP_REPO = REPO;
export const GEP_BRANCH = 'main';
const rawUrl = (ref: string, path: string) => `https://raw.githubusercontent.com/${REPO}/${ref}/${path}`;
export const CACHE_KEY_GEPS = 'kepler_geps_v3';
export const CACHE_KEY_GEP_TREE = 'kepler_gep_tree_v1';
const CACHE_KEY_GEP_GIT = 'kepler_gep_git_v2';
const CACHE_TTL_TREE = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_GEPS = 6 * 60 * 60 * 1000; // 6 hours

const GEP_PATH_PATTERN = /^geps\/gep-(\d+)\/metadata\.yaml$/;
// Matches GEP file paths like: geps/gep-<number>/...
export const GEP_FILE_PATTERN = /^geps\/gep-(\d+)\//;

/** The metadata.yaml of the GEP a repo file belongs to, e.g. its index.md. */
export function gepPathForFile(filename: string): string | null {
  const dir = filename.match(/^geps\/gep-\d+(?=\/)/)?.[0];
  return dir ? `${dir}/metadata.yaml` : null;
}

export function parseGepPath(path: string): { number: string } | null {
  const match = path.match(GEP_PATH_PATTERN);
  if (!match) return null;
  return { number: match[1] };
}

export function buildGepPath(number: string): string {
  return `geps/gep-${number}/metadata.yaml`;
}

/** metadata.yaml paths; pass a commit to read it exactly (uncached). */
export function fetchGepPaths(ref?: string): Promise<string[]> {
  return ref
    ? fetchTreePaths(REPO, GEP_PATH_PATTERN, null, 0, ref)
    : fetchTreePaths(REPO, GEP_PATH_PATTERN, CACHE_KEY_GEP_TREE, CACHE_TTL_TREE);
}

export async function fetchGepYaml(path: string, ref = GEP_BRANCH): Promise<Gep> {
  const [response, content] = await Promise.all([
    githubFetch(rawUrl(ref, path)),
    fetchText(rawUrl(ref, path.replace('/metadata.yaml', '/index.md'))),
  ]);
  if (response.status === 404) throw new NotFoundError(`${path} not found`);
  if (!response.ok)
    throw new Error(`Failed to fetch ${path}: ${response.status}`);

  const text = await response.text();

  const metadata = normalizeGepMetadata(yamlLoad(text));
  if (!metadata) {
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
  return fetchText(rawUrl(GEP_BRANCH, `${dirPath}/index.md`));
}

/**
 * Returns the last `limit` GEPs changed in git history, most-recent first.
 */
export function fetchRecentlyChangedGeps(limit = 10): Promise<GitChange[]> {
  // Most gateway-api PRs don't touch geps/, and PRs are squash-merged, so
  // path-filtered commits (one per PR) need the fewest requests.
  return fetchRecentlyChanged(REPO, 'geps/', GEP_FILE_PATTERN, CACHE_KEY_GEP_GIT, 'commits', limit);
}

/** Newest GEP numbers first, the order lists are shown in. */
export function compareGepsByNumber(a: Gep, b: Gep): number {
  return Number(b.number) - Number(a.number);
}

/** Fetches every GEP at `ref` (a branch or commit), without caching. */
export async function crawlGeps(
  ref = GEP_BRANCH,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Gep[]> {
  const paths = await fetchGepPaths(ref === GEP_BRANCH ? undefined : ref);
  const results = await fetchAllBatched(paths, (p) => fetchGepYaml(p, ref), onProgress);
  return results.sort(compareGepsByNumber);
}

export async function fetchAllGeps(
  onProgress?: (loaded: number, total: number) => void,
): Promise<Gep[]> {
  const cached = getCached<Gep[]>(CACHE_KEY_GEPS, CACHE_TTL_GEPS);
  if (cached) {
    onProgress?.(cached.length, cached.length);
    return cached;
  }

  const results = await crawlGeps(GEP_BRANCH, onProgress);
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
export function fetchGatewayApiPRs(
  changelogUrls: string[],
): Promise<PRInfo[]> {
  const prNumbers = changelogUrls
    .map((url) => {
      const m = url.match(/kubernetes-sigs\/gateway-api\/pull\/(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n): n is number => n !== null);

  if (prNumbers.length === 0) return Promise.resolve([]);
  return cachedPRStatus(`${REPO}#${prNumbers.join(',')}`, () => loadGatewayApiPRs(prNumbers));
}

/** `complete` is false if any request failed, so the result isn't cached. */
async function loadGatewayApiPRs(prNumbers: number[]): Promise<PRStatusResult> {
  let complete = true;

  const results = await Promise.all(
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
          const [reviewStatus, ciStatus] = await Promise.all([
            fetchReviewStatus(REPO, prNum, pr.merged_at !== null),
            fetchCIStatus(REPO, pr.head.sha),
          ]);
          if (reviewStatus === undefined || ciStatus === undefined) complete = false;
          info.reviewStatus = reviewStatus ?? 'none';
          info.ciStatus = ciStatus ?? 'unknown';
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
          } else {
            complete = false;
          }
        }
      } catch {
        complete = false;
      }

      return info;
    }),
  );
  return { data: results, complete };
}
