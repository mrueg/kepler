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
import { fetchAllKeps, fetchKepPaths, fetchRecentlyChangedKeps } from '../src/api/github';
import { fetchAllGeps, fetchGepPaths, fetchRecentlyChangedGeps } from '../src/api/gatewayapi';
import { fetchAllCaeps, fetchCaepPaths } from '../src/api/clusterapi';
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

function write<T>(name: SnapshotName | 'meta', data: T): void {
  const snapshot: Snapshot<T> = { generatedAt, data };
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(snapshot));
}

const counts: Record<string, number> = {};
const skipped: string[] = [];

async function dataset<T>(name: SnapshotName, build: () => Promise<{ data: T; count: number }>): Promise<void> {
  const started = Date.now();
  try {
    const { data, count } = await build();
    write(name, data);
    counts[name] = count;
    console.log(`${name}: ${count} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (err) {
    skipped.push(name);
    const message = err instanceof Error ? err.message : String(err);
    // GitHub Actions annotation; the site falls back to live data for this one.
    console.log(`::warning title=Snapshot ${name} skipped::${message}`);
  }
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

  await dataset('keps', async () => {
    // kep.readme is already limited to a README excerpt.
    const keps = await crawl('KEPs', fetchKepPaths, () => fetchAllKeps());
    return { data: keps, count: keps.length };
  });
  await dataset('geps', async () => {
    const geps = await crawl('GEPs', fetchGepPaths, () => fetchAllGeps());
    return { data: geps.map((g) => ({ ...g, content: truncateText(g.content) })), count: geps.length };
  });
  await dataset('caeps', async () => {
    const caeps = await crawl('CAEPs', fetchCaepPaths, () => fetchAllCaeps());
    return { data: caeps.map((c) => ({ ...c, content: truncateText(c.content) })), count: caeps.length };
  });
  for (const [name, fetchRecent] of [
    ['recent-keps', fetchRecentlyChangedKeps],
    ['recent-geps', fetchRecentlyChangedGeps],
  ] as const) {
    await dataset(name, async () => {
      const changes = await fetchRecent();
      // These return [] on failure rather than throwing.
      if (changes.length === 0) throw new Error('no recent changes could be fetched');
      return { data: changes.map((c) => ({ number: c.number, date: c.date.toISOString() })), count: changes.length };
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
