import yaml from 'js-yaml';
import type { Kep, KepMetadata } from '../types/kep';

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/kubernetes/enhancements/master';
const GITHUB_API_BASE = 'https://api.github.com';
const CACHE_KEY_KEPS = 'kepler_keps_v2';
const CACHE_KEY_TREE = 'kepler_tree_v2';
const CACHE_TTL_TREE = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_KEPS = 6 * 60 * 60 * 1000; // 6 hours

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

export async function fetchKepMarkdown(path: string): Promise<string> {
  const mdPath = path.replace(/\/kep\.yaml$/, '/README.md');
  const response = await fetch(`${GITHUB_RAW_BASE}/${mdPath}`);
  if (!response.ok)
    throw new Error(`Failed to fetch ${mdPath}: ${response.status}`);
  return response.text();
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
