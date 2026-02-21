import yaml from 'js-yaml';
import type { Gep, GepMetadata } from '../types/gep';

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/kubernetes-sigs/gateway-api/main';
const GITHUB_API_BASE = 'https://api.github.com';
const CACHE_KEY_GEPS = 'kepler_geps_v1';
const CACHE_KEY_GEP_TREE = 'kepler_gep_tree_v1';
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
  const response = await fetch(`${GITHUB_RAW_BASE}/${path}`);
  if (!response.ok)
    throw new Error(`Failed to fetch ${path}: ${response.status}`);

  const text = await response.text();
  const metadata = yaml.load(text) as GepMetadata | null;
  if (!metadata || typeof metadata.number === 'undefined' || !metadata.name) {
    throw new Error(`Invalid GEP metadata at ${path}`);
  }
  const dirPath = path.replace('/metadata.yaml', '');

  return {
    ...metadata,
    path,
    githubUrl: `https://github.com/kubernetes-sigs/gateway-api/tree/main/${dirPath}`,
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
