import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadKeps, loadRecentKepChanges, loadReleaseTracking } from './loaders';
import { loadSnapshot, SNAPSHOT_MAX_AGE_MS } from './snapshot';
import { CACHE_KEY_KEPS } from './github';
import { readCache } from './shared';
import { json, stubFetch } from '../test/fetch';
import type { Kep } from '../types/kep';

afterEach(() => {
  vi.useRealTimers();
});

const kep = (number: string): Kep => ({
  path: `keps/sig-node/${number}-x/kep.yaml`,
  number,
  sig: 'sig-node',
  slug: 'x',
  githubUrl: '',
  readme: 'long README text',
});

function stubSnapshots(files: Record<string, unknown>) {
  return stubFetch((url) => {
    const name = url.match(/^\/data\/(.+)\.json$/)?.[1];
    return name && name in files ? json(files[name]) : undefined;
  });
}

describe('loadSnapshot', () => {
  it('returns fresh snapshots, once per page load', async () => {
    const fetchMock = stubSnapshots({ keps: { generatedAt: new Date().toISOString(), data: [1] } });
    await expect(loadSnapshot('keps')).resolves.toMatchObject({ data: [1] });
    await loadSnapshot('keps');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores missing, stale and malformed snapshots', async () => {
    stubSnapshots({
      geps: { generatedAt: new Date(Date.now() - SNAPSHOT_MAX_AGE_MS - 1000).toISOString(), data: [] },
      caeps: { nonsense: true },
    });
    await expect(loadSnapshot('keps')).resolves.toBeNull();
    await expect(loadSnapshot('geps')).resolves.toBeNull();
    await expect(loadSnapshot('caeps')).resolves.toBeNull();
  });
});

describe('loadKeps', () => {
  it('uses the snapshot without contacting GitHub, and fills the list cache dated to the snapshot', async () => {
    const generatedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const fetchMock = stubSnapshots({ keps: { generatedAt, data: [kep('753'), kep('2400')] } });
    const onProgress = vi.fn();

    const keps = await loadKeps(onProgress);

    expect(keps.map((k) => k.number)).toEqual(['753', '2400']);
    expect(keps[0].readme).toBe('long README text');
    expect(onProgress).toHaveBeenCalledWith(2, 2);
    expect(fetchMock.mock.calls.map(([u]) => String(u))).toEqual(['/data/keps.json']);

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY_KEPS)!);
    expect(cached.timestamp).toBe(Date.parse(generatedAt));
    expect(readCache<Kep[]>(CACHE_KEY_KEPS)?.[0]).not.toHaveProperty('readme');
  });

  it('fetches live when there is no snapshot', async () => {
    const fetchMock = stubFetch((url) =>
      url.includes('/git/trees/') ? json({ tree: [] }) : undefined,
    );
    await expect(loadKeps()).resolves.toEqual([]);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('api.github.com'))).toBe(true);
  });
});

describe('other loaders', () => {
  it('revives dates in recent changes', async () => {
    stubSnapshots({ 'recent-keps': { generatedAt: new Date().toISOString(), data: [{ number: '753', date: '2026-10-07T10:00:00.000Z' }] } });
    const [change] = await loadRecentKepChanges();
    expect(change.number).toBe('753');
    expect(change.date).toBeInstanceOf(Date);
    expect(change.date.toISOString()).toBe('2026-10-07T10:00:00.000Z');
  });

  it('serves release tracking from the snapshot', async () => {
    const tracking = { milestone: { number: 1, title: 'v1.38', openIssues: 89, closedIssues: 0 }, items: [] };
    const fetchMock = stubSnapshots({ 'release-tracking': { generatedAt: new Date().toISOString(), data: tracking } });
    await expect(loadReleaseTracking()).resolves.toEqual(tracking);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
