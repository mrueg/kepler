import type { Caep } from '../types/caep';
import { githubFetch } from '../utils/githubFetch';
import { firstHeading, parseFrontMatter } from '../utils/frontMatter';
import { normalizeCaepMetadata } from '../utils/normalize';
import { NotFoundError, fetchAllBatched, fetchTreePaths, getCached, setCache } from './shared';

const REPO = 'kubernetes-sigs/cluster-api';
const BRANCH = 'main';
export const CAEP_REPO = REPO;
export const CAEP_BRANCH = BRANCH;
export const CACHE_KEY_CAEPS = 'kepler_caeps_v1';
export const CACHE_KEY_CAEP_TREE = 'kepler_caep_tree_v1';
const CACHE_TTL_TREE = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_CAEPS = 6 * 60 * 60 * 1000; // 6 hours

// docs/proposals/YYYYMMDD-slug.md, or under archived/. The 8-digit date
// excludes the YYYYMMDD-template.md file.
const CAEP_PATH_PATTERN = /^docs\/proposals\/(archived\/)?((\d{4})(\d{2})(\d{2})-[^/]+)\.md$/;

export interface CaepPathInfo {
  id: string;
  date: string;
  archived: boolean;
}

export function parseCaepPath(path: string): CaepPathInfo | null {
  const match = path.match(CAEP_PATH_PATTERN);
  if (!match) return null;
  return { id: match[2], date: `${match[3]}-${match[4]}-${match[5]}`, archived: match[1] !== undefined };
}

/** Raw/GitHub URL for a repo path; file names can contain spaces and parentheses. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export function caepHref(id: string): string {
  return `/caep?id=${encodeURIComponent(id)}`;
}

/**
 * The CAEP id a see-also/replaces reference points to, if any. References are
 * written as repo paths ("/docs/proposals/2019...md") or full GitHub URLs.
 */
export function caepIdFromReference(ref: string): string | null {
  const match = decodeURIComponent(ref).match(/docs\/proposals\/(?:archived\/)?(\d{8}-[^/#?]+)\.md/);
  return match ? match[1] : null;
}

/** Proposal paths; pass a commit to read it exactly (uncached). */
export function fetchCaepPaths(ref?: string): Promise<string[]> {
  return ref
    ? fetchTreePaths(REPO, CAEP_PATH_PATTERN, null, 0, ref)
    : fetchTreePaths(REPO, CAEP_PATH_PATTERN, CACHE_KEY_CAEP_TREE, CACHE_TTL_TREE);
}

export async function findCaepPath(id: string): Promise<string | null> {
  const paths = await fetchCaepPaths();
  return paths.find((p) => parseCaepPath(p)?.id === id) ?? null;
}

/** Builds a CAEP from its Markdown file; title falls back to the first heading, then the file name. */
export function parseCaep(path: string, markdown: string): Caep {
  const info = parseCaepPath(path);
  if (!info) throw new Error(`Not a CAEP path: ${path}`);
  const { data, body } = parseFrontMatter(markdown);
  const metadata = normalizeCaepMetadata(data);
  const dir = path.slice(0, path.lastIndexOf('/'));
  return {
    ...metadata,
    ...info,
    title: metadata.title ?? firstHeading(body) ?? info.id.replace(/^\d{8}-/, '').replace(/-/g, ' ').trim(),
    path,
    githubUrl: `https://github.com/${REPO}/blob/${BRANCH}/${encodePath(path)}`,
    githubDirUrl: `https://github.com/${REPO}/tree/${BRANCH}/${dir}`,
    content: body,
  };
}

export async function fetchCaep(path: string, ref = BRANCH): Promise<Caep> {
  const response = await githubFetch(`https://raw.githubusercontent.com/${REPO}/${ref}/${encodePath(path)}`);
  if (response.status === 404) throw new NotFoundError(`${path} not found`);
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
  return parseCaep(path, await response.text());
}

/** Lowercased text that search queries are matched against. */
export function caepSearchText(caep: Caep): string {
  return [caep.title, caep.id, ...(caep.authors ?? []), caep.content]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

/** Newest first, by the date in the file name. */
export function compareCaepsByDate(a: Caep, b: Caep): number {
  return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
}

/** Fetches every CAEP at `ref` (a branch or commit), without caching. */
export async function crawlCaeps(
  ref = BRANCH,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Caep[]> {
  const paths = await fetchCaepPaths(ref === BRANCH ? undefined : ref);
  const results = await fetchAllBatched(paths, (p) => fetchCaep(p, ref), onProgress);
  return results.sort(compareCaepsByDate);
}

export async function fetchAllCaeps(
  onProgress?: (loaded: number, total: number) => void,
): Promise<Caep[]> {
  const cached = getCached<Caep[]>(CACHE_KEY_CAEPS, CACHE_TTL_CAEPS);
  if (cached) {
    onProgress?.(cached.length, cached.length);
    return cached;
  }

  const results = await crawlCaeps(BRANCH, onProgress);
  // Strip content before caching to avoid exceeding localStorage size limits
  setCache(CACHE_KEY_CAEPS, results.map(({ content: _content, ...caep }) => caep));
  return results;
}
