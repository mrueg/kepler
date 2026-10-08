import { load as yamlLoad } from 'js-yaml';
import type { Kep } from '../types/kep';
import { normalizeKepMetadata } from '../utils/normalize';
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

const REPO = 'kubernetes/enhancements';
export const KEP_REPO = REPO;
export const KEP_BRANCH = 'master';
const rawUrl = (ref: string, path: string) => `https://raw.githubusercontent.com/${REPO}/${ref}/${path}`;
export const CACHE_KEY_KEPS = 'kepler_keps_v6';
export const CACHE_KEY_TREE = 'kepler_tree_v2';
const CACHE_KEY_KEP_GIT = 'kepler_kep_git_v2';
const CACHE_TTL_TREE = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_KEPS = 6 * 60 * 60 * 1000; // 6 hours

const KEP_PATH_PATTERN = /^keps\/(sig-[^/]+)\/(\d+)-([^/]+)\/kep\.yaml$/;
// Matches KEP file paths like: keps/sig-<name>/<number>-<title>/...
export const KEP_FILE_PATTERN = /^keps\/sig-[^/]+\/(\d+)-[^/]+\//;

/** The kep.yaml of the KEP a repo file belongs to, e.g. its README.md. */
export function kepPathForFile(filename: string): string | null {
  const dir = filename.match(/^keps\/sig-[^/]+\/\d+-[^/]+(?=\/)/)?.[0];
  return dir ? `${dir}/kep.yaml` : null;
}

export function parseKepPath(
  path: string,
): { sig: string; number: string; slug: string } | null {
  const match = path.match(KEP_PATH_PATTERN);
  if (!match) return null;
  return { sig: match[1], number: match[2], slug: match[3] };
}

/** kep.yaml paths; pass a commit to read it exactly (uncached). */
export function fetchKepPaths(ref?: string): Promise<string[]> {
  return ref
    ? fetchTreePaths(REPO, KEP_PATH_PATTERN, null, 0, ref)
    : fetchTreePaths(REPO, KEP_PATH_PATTERN, CACHE_KEY_TREE, CACHE_TTL_TREE);
}

/** Resolves a KEP number to its kep.yaml path, fetching the repo tree if needed. */
export async function findKepPath(number: string): Promise<string | null> {
  const paths = await fetchKepPaths();
  return paths.find((p) => parseKepPath(p)?.number === number) ?? null;
}

export async function fetchKepYaml(path: string, ref = KEP_BRANCH): Promise<Kep> {
  const [yamlResponse, readmeText] = await Promise.all([
    githubFetch(rawUrl(ref, path)),
    fetchText(rawUrl(ref, path.replace('/kep.yaml', '/README.md'))),
  ]);
  if (yamlResponse.status === 404) throw new NotFoundError(`${path} not found`);
  if (!yamlResponse.ok)
    throw new Error(`Failed to fetch ${path}: ${yamlResponse.status}`);

  const text = await yamlResponse.text();
  const readme = readmeText ? readmeText.slice(0, 5000) : undefined;

  const metadata = normalizeKepMetadata(yamlLoad(text));
  const pathInfo = parseKepPath(path)!;
  const dirPath = path.replace('/kep.yaml', '');

  return {
    ...metadata,
    path,
    ...pathInfo,
    title: metadata.title || `KEP-${pathInfo.number}`,
    githubUrl: `https://github.com/${REPO}/tree/master/${dirPath}`,
    ...(readme !== undefined ? { readme } : {}),
  };
}

/**
 * True when `title` mentions the KEP number as a whole number, so KEP-12
 * doesn't match a PR titled "KEP-1234: ...".
 */
export function titleMentionsKep(title: string, kepNumber: string): boolean {
  return new RegExp(`(?:^|\\D)${kepNumber}(?:\\D|$)`).test(title);
}

export function fetchEnhancementPRs(kepNumber: string): Promise<PRInfo[]> {
  return cachedPRStatus(`${REPO}#${kepNumber}`, () => loadEnhancementPRs(kepNumber));
}

/** Returns null if the PR search failed; `complete` is false if a status request failed. */
async function loadEnhancementPRs(kepNumber: string): Promise<PRStatusResult | null> {
  try {
    const searchUrl = `${GITHUB_API_BASE}/search/issues?q=repo:${REPO}+is:pr+${encodeURIComponent(kepNumber)}&per_page=5&sort=updated&order=desc`;
    const searchResp = await githubFetch(searchUrl);
    if (!searchResp.ok) return null;
    const searchData = (await searchResp.json()) as {
      items: { number: number; title: string; state: string; html_url: string; pull_request?: { merged_at: string | null }; draft?: boolean; user: { login: string } }[];
    };

    const prs = searchData.items.filter((item) => titleMentionsKep(item.title, kepNumber));
    let complete = true;

    const results = await Promise.all(
      prs.slice(0, 3).map(async (item): Promise<PRInfo> => {
        const merged_at = item.pull_request?.merged_at ?? null;
        const [reviewStatus, ciStatus] = await Promise.all([
          fetchReviewStatus(REPO, item.number, merged_at !== null),
          (async () => {
            try {
              const prDetailResp = await githubFetch(`${GITHUB_API_BASE}/repos/${REPO}/pulls/${item.number}`);
              if (!prDetailResp.ok) return undefined;
              const prDetail = (await prDetailResp.json()) as { head: { sha: string } };
              return await fetchCIStatus(REPO, prDetail.head.sha);
            } catch {
              return undefined;
            }
          })(),
        ]);
        if (reviewStatus === undefined || ciStatus === undefined) complete = false;

        return {
          number: item.number,
          title: item.title,
          state: normalizePRState(item.state),
          html_url: item.html_url,
          draft: item.draft ?? false,
          merged_at,
          user: item.user,
          ciStatus: ciStatus ?? 'unknown',
          reviewStatus: reviewStatus ?? 'none',
        };
      }),
    );
    return { data: results, complete };
  } catch {
    return null;
  }
}

export function fetchKepReadme(kepPath: string): Promise<string | null> {
  const dirPath = kepPath.slice(0, kepPath.lastIndexOf('/'));
  return fetchText(rawUrl(KEP_BRANCH, `${dirPath}/README.md`));
}

/**
 * Returns the last `limit` KEPs changed in git history, most-recent first.
 */
export function fetchRecentlyChangedKeps(limit = 10): Promise<GitChange[]> {
  // Nearly every PR to kubernetes/enhancements touches keps/, so walking merged
  // PRs needs the fewest requests and dates changes by when they merged.
  return fetchRecentlyChanged(REPO, 'keps/', KEP_FILE_PATTERN, CACHE_KEY_KEP_GIT, 'merged-pulls', limit);
}

/** Newest KEP numbers first, the order lists are shown in. */
export function compareKepsByNumber(a: Kep, b: Kep): number {
  return Number(b.number) - Number(a.number);
}

/** Fetches every KEP at `ref` (a branch or commit), without caching. */
export async function crawlKeps(
  ref = KEP_BRANCH,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Kep[]> {
  const paths = await fetchKepPaths(ref === KEP_BRANCH ? undefined : ref);
  const results = await fetchAllBatched(paths, (p) => fetchKepYaml(p, ref), onProgress);
  return results.sort(compareKepsByNumber);
}

export async function fetchAllKeps(
  onProgress?: (loaded: number, total: number) => void,
): Promise<Kep[]> {
  const cached = getCached<Kep[]>(CACHE_KEY_KEPS, CACHE_TTL_KEPS);
  if (cached) {
    onProgress?.(cached.length, cached.length);
    return cached;
  }

  const results = await crawlKeps(KEP_BRANCH, onProgress);
  // Strip readme before caching to avoid exceeding localStorage size limits
  const kepsToCache = results.map(({ readme: _readme, ...kep }) => kep);
  setCache(CACHE_KEY_KEPS, kepsToCache);
  return results;
}
