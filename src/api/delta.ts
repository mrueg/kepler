// Brings a prebuilt snapshot up to date: one compare request per repo lists
// the files changed since the snapshot's commit, and only the affected
// proposals are re-fetched (from raw.githubusercontent.com, which doesn't
// count against the API rate limit).

import { githubFetch } from '../utils/githubFetch';
import { GITHUB_API_BASE, NotFoundError, readCache, setCache, type GitChange } from './shared';

export interface ChangedFile {
  filename: string;
  status: string;
  /** Set for renames. */
  previous_filename?: string;
}

export interface CompareResult {
  /** The commit the changes lead up to; patched data is read at this commit. */
  head: string;
  files: ChangedFile[];
  /** Committer date of the newest commit in the range, if any. */
  latestCommitDate?: string;
  /** False when GitHub truncated the comparison (too many commits or files). */
  complete: boolean;
  /** When the comparison was fetched (ms since epoch). */
  checkedAt: number;
}

const COMPARE_CACHE_KEY = 'kepler_compare_v1';
export const COMPARE_TTL_MS = 10 * 60 * 1000;
// GitHub's compare endpoint lists at most 300 files.
const MAX_COMPARE_FILES = 300;

type CompareCache = Record<string, CompareResult>;
const inFlight = new Map<string, Promise<CompareResult | null>>();

/**
 * Files changed in `repo` since `base`, up to `branch`. Cached for 10 minutes
 * (shared across tabs) so navigating around doesn't repeat the request.
 * Returns null on errors or if `base` isn't an ancestor of `branch` anymore.
 */
export function fetchChangesSince(repo: string, base: string, branch: string): Promise<CompareResult | null> {
  const key = `${repo}@${base}`;
  const cached = readCache<CompareCache>(COMPARE_CACHE_KEY)?.[key];
  if (cached && Date.now() - cached.checkedAt < COMPARE_TTL_MS) return Promise.resolve(cached);

  let promise = inFlight.get(key);
  if (!promise) {
    promise = (async () => {
      try {
        const resp = await githubFetch(`${GITHUB_API_BASE}/repos/${repo}/compare/${base}...${branch}`);
        if (!resp.ok) return null;
        const body = (await resp.json()) as {
          status: string;
          total_commits: number;
          commits: Array<{ sha: string; commit: { committer: { date: string } } }>;
          files?: ChangedFile[];
        };
        // "diverged"/"behind": history was rewritten; the snapshot can't be patched.
        if (body.status !== 'ahead' && body.status !== 'identical') return null;
        const files = (body.files ?? []).map(({ filename, status, previous_filename }) => ({
          filename,
          status,
          ...(previous_filename ? { previous_filename } : {}),
        }));
        const dates = body.commits.map((c) => c.commit.committer.date).sort();
        const result: CompareResult = {
          head: body.commits.at(-1)?.sha ?? base,
          files,
          latestCommitDate: dates.at(-1),
          complete: body.total_commits <= body.commits.length && files.length < MAX_COMPARE_FILES,
          checkedAt: Date.now(),
        };
        const latest = readCache<CompareCache>(COMPARE_CACHE_KEY) ?? {};
        const pruned = Object.fromEntries(
          Object.entries(latest).filter(([, r]) => Date.now() - r.checkedAt < COMPARE_TTL_MS),
        );
        setCache(COMPARE_CACHE_KEY, { ...pruned, [key]: result });
        return result;
      } catch {
        return null;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, promise);
  }
  return promise;
}

export interface DeltaSource<T> {
  /** The metadata path of the proposal a changed file belongs to, or null. */
  proposalPathFor(filename: string): string | null;
  /** Fetches a proposal at `ref`; throws NotFoundError if it doesn't exist. */
  fetchItem(path: string, ref: string): Promise<T>;
  /** List order. */
  compare(a: T, b: T): number;
}

/**
 * Applies changed files to `items`: every affected proposal is re-fetched at
 * `ref` and replaced, added, or (if gone) removed. `complete` is false if a
 * re-fetch failed for another reason; the old entry is kept then.
 */
export async function applyChanges<T extends { path: string }>(
  items: T[],
  files: ChangedFile[],
  source: DeltaSource<T>,
  ref: string,
): Promise<{ items: T[]; complete: boolean }> {
  const affected = new Set<string>();
  for (const file of files) {
    for (const name of [file.filename, file.previous_filename]) {
      const path = name ? source.proposalPathFor(name) : null;
      if (path) affected.add(path);
    }
  }
  if (affected.size === 0) return { items, complete: true };

  const byPath = new Map(items.map((item) => [item.path, item]));
  let complete = true;
  await Promise.all(
    [...affected].map(async (path) => {
      try {
        byPath.set(path, await source.fetchItem(path, ref));
      } catch (err) {
        if (err instanceof NotFoundError) byPath.delete(path);
        else complete = false;
      }
    }),
  );
  return { items: [...byPath.values()].sort(source.compare), complete };
}

/**
 * Puts proposals touched by `files` at the top of a "What's New" list, dated
 * `date` (the newest commit in the range; the list shows days, not hours).
 */
export function applyRecentChanges(
  recent: GitChange[],
  files: ChangedFile[],
  numberPattern: RegExp,
  date: Date,
  limit = 10,
): GitChange[] {
  const changed: string[] = [];
  for (const file of files) {
    for (const name of [file.filename, file.previous_filename]) {
      const number = name?.match(numberPattern)?.[1];
      if (number && !changed.includes(number)) changed.push(number);
    }
  }
  if (changed.length === 0) return recent;
  return [
    ...changed.map((number) => ({ number, date })),
    ...recent.filter((c) => !changed.includes(c.number)),
  ].slice(0, limit);
}

/** For tests: forget in-flight comparisons. */
export function resetDeltaState(): void {
  inFlight.clear();
}
