// Prebuilds proposal data into public/data/*.json for the deployed site, so
// visitors load static files instead of crawling GitHub. Run before
// `next build` (see .github/workflows/deploy.yml):
//
//   GITHUB_TOKEN=... npm run fetch-data
//
// A dataset that can't be fetched completely is skipped with a warning; the
// site then fetches that data live, as it does without snapshots.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KEP_BRANCH, KEP_REPO, crawlKeps, fetchKepPaths, fetchRecentlyChangedKeps } from '../src/api/github';
import { GEP_BRANCH, GEP_REPO, crawlGeps, fetchGepPaths, fetchRecentlyChangedGeps } from '../src/api/gatewayapi';
import { CAEP_BRANCH, CAEP_REPO, crawlCaeps, fetchCaepPaths, fetchRecentlyChangedCaeps } from '../src/api/clusterapi';
import { GITHUB_API_BASE } from '../src/api/shared';
import { githubFetch } from '../src/utils/githubFetch';
import { fetchReleaseTracking } from '../src/api/loaders';
import type { Snapshot, SnapshotName } from '../src/api/snapshot';
import { shouldSendToken } from '../src/utils/githubToken';
import { isComplete, truncateText } from '../src/utils/snapshotBuild';

const OUT_DIR = join(process.cwd(), 'public', 'data');
const generatedAt = new Date().toISOString();

// Authenticate GitHub API requests with the workflow token (1,000 requests per
// hour instead of 60). Only api.github.com gets it, as in the browser.
const token = process.env.GITHUB_TOKEN;
if (token) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (!shouldSendToken(url)) return realFetch(input, init);
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return realFetch(input, { ...init, headers });
  };
} else {
  console.warn('GITHUB_TOKEN is not set; using the unauthenticated rate limit (60 requests/hour).');
}

function write<T>(name: SnapshotName | 'meta', data: T, commit?: string): void {
  const snapshot: Snapshot<T> = { generatedAt, ...(commit ? { commit } : {}), data };
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(snapshot));
}

const counts: Record<string, number> = {};
const skipped: string[] = [];

async function dataset<T>(
  name: SnapshotName,
  build: () => Promise<{ data: T; count: number; commit?: string }>,
): Promise<void> {
  const started = Date.now();
  try {
    const { data, count, commit } = await build();
    write(name, data, commit);
    counts[name] = count;
    console.log(`${name}: ${count} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (err) {
    skipped.push(name);
    const message = err instanceof Error ? err.message : String(err);
    // GitHub Actions annotation; the site falls back to live data for this one.
    console.log(`::warning title=Snapshot ${name} skipped::${message}`);
  }
}

/** The commit a branch points to; the snapshot is read at it so later changes can be applied. */
async function headCommit(repo: string, branch: string): Promise<string> {
  const resp = await githubFetch(`${GITHUB_API_BASE}/repos/${repo}/commits/${branch}`);
  if (!resp.ok) throw new Error(`couldn't resolve ${repo}@${branch}: ${resp.status}`);
  return ((await resp.json()) as { sha: string }).sha;
}

async function crawl<T>(label: string, fetchPaths: () => Promise<string[]>, fetchAll: () => Promise<T[]>) {
  const expected = (await fetchPaths()).length;
  const items = await fetchAll();
  if (!isComplete(items.length, expected)) {
    throw new Error(`only ${items.length} of ${expected} ${label} could be fetched`);
  }
  return items;
}

async function main(): Promise<void> {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  // Everything is read at a fixed commit, so a commit landing mid-crawl can't
  // produce a mixed snapshot, and the site can apply later changes on top.
  const commits = new Map<string, string>();
  const commitOf = async (repo: string, branch: string) => {
    if (!commits.has(repo)) commits.set(repo, await headCommit(repo, branch));
    return commits.get(repo)!;
  };

  await dataset('keps', async () => {
    const commit = await commitOf(KEP_REPO, KEP_BRANCH);
    // kep.readme is already limited to a README excerpt.
    const keps = await crawl('KEPs', () => fetchKepPaths(commit), () => crawlKeps(commit));
    return { data: keps, count: keps.length, commit };
  });
  await dataset('geps', async () => {
    const commit = await commitOf(GEP_REPO, GEP_BRANCH);
    const geps = await crawl('GEPs', () => fetchGepPaths(commit), () => crawlGeps(commit));
    return { data: geps.map((g) => ({ ...g, content: truncateText(g.content) })), count: geps.length, commit };
  });
  await dataset('caeps', async () => {
    const commit = await commitOf(CAEP_REPO, CAEP_BRANCH);
    const caeps = await crawl('CAEPs', () => fetchCaepPaths(commit), () => crawlCaeps(commit));
    return { data: caeps.map((c) => ({ ...c, content: truncateText(c.content) })), count: caeps.length, commit };
  });
  for (const [name, fetchRecent, repo, branch] of [
    ['recent-keps', fetchRecentlyChangedKeps, KEP_REPO, KEP_BRANCH],
    ['recent-geps', fetchRecentlyChangedGeps, GEP_REPO, GEP_BRANCH],
    ['recent-caeps', fetchRecentlyChangedCaeps, CAEP_REPO, CAEP_BRANCH],
  ] as const) {
    await dataset(name, async () => {
      const commit = await commitOf(repo, branch);
      const changes = await fetchRecent();
      // These return [] on failure rather than throwing.
      if (changes.length === 0) throw new Error('no recent changes could be fetched');
      return { data: changes.map((c) => ({ number: c.number, date: c.date.toISOString() })), count: changes.length, commit };
    });
  }
  await dataset('release-tracking', async () => {
    const tracking = await fetchReleaseTracking();
    return { data: tracking, count: tracking.items.length };
  });

  write('meta', { counts, skipped });
  console.log(skipped.length ? `Done; skipped: ${skipped.join(', ')}` : 'Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
