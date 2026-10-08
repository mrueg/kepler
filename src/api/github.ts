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
  type GitChange,
  type PRInfo,
} from './shared';

const REPO = 'kubernetes/enhancements';
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${REPO}/master`;
export const CACHE_KEY_KEPS = 'kepler_keps_v5';
export const CACHE_KEY_TREE = 'kepler_tree_v2';
const CACHE_KEY_KEP_GIT = 'kepler_kep_git_v1';
const CACHE_TTL_TREE = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_KEPS = 6 * 60 * 60 * 1000; // 6 hours

const KEP_PATH_PATTERN = /^keps\/(sig-[^/]+)\/(\d+)-([^/]+)\/kep\.yaml$/;
// Matches KEP file paths like: keps/sig-<name>/<number>-<title>/...
const KEP_FILE_PATTERN = /^keps\/sig-[^/]+\/(\d+)-[^/]+\//;

export function parseKepPath(
  path: string,
): { sig: string; number: string; slug: string } | null {
  const match = path.match(KEP_PATH_PATTERN);
  if (!match) return null;
  return { sig: match[1], number: match[2], slug: match[3] };
}

export function fetchKepPaths(): Promise<string[]> {
  return fetchTreePaths(REPO, KEP_PATH_PATTERN, CACHE_KEY_TREE, CACHE_TTL_TREE);
}

/** Resolves a KEP number to its kep.yaml path, fetching the repo tree if needed. */
export async function findKepPath(number: string): Promise<string | null> {
  const paths = await fetchKepPaths();
  return paths.find((p) => parseKepPath(p)?.number === number) ?? null;
}

export async function fetchKepYaml(path: string): Promise<Kep> {
  const [yamlResponse, readmeText] = await Promise.all([
    githubFetch(`${GITHUB_RAW_BASE}/${path}`),
    fetchText(`${GITHUB_RAW_BASE}/${path.replace('/kep.yaml', '/README.md')}`),
  ]);
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

export async function fetchEnhancementPRs(
  kepNumber: string,
): Promise<PRInfo[]> {
  try {
    const searchUrl = `${GITHUB_API_BASE}/search/issues?q=repo:${REPO}+is:pr+${encodeURIComponent(kepNumber)}&per_page=5&sort=updated&order=desc`;
    const searchResp = await githubFetch(searchUrl);
    if (!searchResp.ok) return [];
    const searchData = (await searchResp.json()) as {
      items: { number: number; title: string; state: string; html_url: string; pull_request?: { merged_at: string | null }; draft?: boolean; user: { login: string } }[];
    };

    const prs = searchData.items.filter((item) => titleMentionsKep(item.title, kepNumber));

    return await Promise.all(
      prs.slice(0, 3).map(async (item): Promise<PRInfo> => {
        const merged_at = item.pull_request?.merged_at ?? null;
        const [reviewStatus, ciStatus] = await Promise.all([
          fetchReviewStatus(REPO, item.number, merged_at !== null),
          (async () => {
            try {
              const prDetailResp = await githubFetch(`${GITHUB_API_BASE}/repos/${REPO}/pulls/${item.number}`);
              if (!prDetailResp.ok) return 'unknown' as const;
              const prDetail = (await prDetailResp.json()) as { head: { sha: string } };
              return await fetchCIStatus(REPO, prDetail.head.sha);
            } catch {
              return 'unknown' as const;
            }
          })(),
        ]);

        return {
          number: item.number,
          title: item.title,
          state: normalizePRState(item.state),
          html_url: item.html_url,
          draft: item.draft ?? false,
          merged_at,
          user: item.user,
          ciStatus,
          reviewStatus,
        };
      }),
    );
  } catch {
    return [];
  }
}

export function fetchKepReadme(kepPath: string): Promise<string | null> {
  const dirPath = kepPath.slice(0, kepPath.lastIndexOf('/'));
  return fetchText(`${GITHUB_RAW_BASE}/${dirPath}/README.md`);
}

/**
 * Returns the last `limit` KEPs changed in git history, most-recent first.
 */
export function fetchRecentlyChangedKeps(limit = 10): Promise<GitChange[]> {
  return fetchRecentlyChanged(REPO, 'keps/', KEP_FILE_PATTERN, CACHE_KEY_KEP_GIT, limit);
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
  const results = await fetchAllBatched(paths, fetchKepYaml, onProgress);

  results.sort((a, b) => Number(b.number) - Number(a.number));
  // Strip readme before caching to avoid exceeding localStorage size limits
  const kepsToCache = results.map(({ readme: _readme, ...kep }) => kep);
  setCache(CACHE_KEY_KEPS, kepsToCache);
  return results;
}
