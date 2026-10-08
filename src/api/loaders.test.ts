import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadKeps, loadRecentCaepChanges, loadRecentKepChanges, loadReleaseTracking } from './loaders';
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

  it('serves release tracking from the snapshot, applying issues changed since', async () => {
    const generatedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const item = (number: string) => ({ number, title: number, tracking: 'tracked', sigs: [], state: 'open', url: '' });
    const tracking = { milestone: { number: 7, title: 'v1.38', openIssues: 89, closedIssues: 0 }, items: [item('1'), item('2')] };
    const labels = [{ name: 'lead-opted-in' }, { name: 'stage/beta' }];
    const fetchMock = stubFetch((url) => {
      if (url === '/data/release-tracking.json') return json({ generatedAt, data: tracking });
      if (url.includes('/issues?state=all&since=')) {
        expect(url).toContain(encodeURIComponent(generatedAt));
        return json([
          { number: 3, title: 'New', state: 'open', html_url: 'u3', labels, milestone: { number: 7 } },
          { number: 2, title: 'Moved on', state: 'open', html_url: 'u2', labels, milestone: { number: 8 } },
          { number: 9, title: 'A PR', state: 'open', html_url: 'u9', labels, milestone: { number: 7 }, pull_request: {} },
        ]);
      }
      return undefined;
    });

    const result = await loadReleaseTracking();
    expect(result.items.map((i) => i.number)).toEqual(['1', '3']);
    expect(result.items[1]).toMatchObject({ stage: 'beta', tracking: 'pending' });

    // Cached for 10 minutes.
    await loadReleaseTracking();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/issues?'))).toHaveLength(1);
  });

  it('falls back to the plain snapshot if the tracking update fails', async () => {
    const tracking = { milestone: { number: 7, title: 'v1.38', openIssues: 1, closedIssues: 0 }, items: [] };
    stubSnapshots({ 'release-tracking': { generatedAt: new Date().toISOString(), data: tracking } });
    await expect(loadReleaseTracking()).resolves.toEqual(tracking);
  });

});

describe('snapshot updates', () => {
  it('applies changes made since the snapshot commit and dates the cache to the check', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T12:00:00Z'), shouldAdvanceTime: true });
    const generatedAt = '2026-10-08T10:00:00.000Z';
    const fetchMock = stubFetch((url) => {
      if (url === '/data/keps.json') {
        return json({ generatedAt, commit: 'snap', data: [kep('753'), kep('2400')] });
      }
      if (url.endsWith('/repos/kubernetes/enhancements/compare/snap...master')) {
        return json({
          status: 'ahead',
          total_commits: 1,
          commits: [{ sha: 'head1', commit: { committer: { date: '2026-10-08T11:30:00Z' } } }],
          files: [
            { filename: 'keps/sig-node/753-x/README.md', status: 'modified' },
            { filename: 'keps/sig-node/2400-x/kep.yaml', status: 'removed' },
            { filename: 'keps/sig-apps/9000-new/kep.yaml', status: 'added' },
          ],
        });
      }
      const raw = url.match(/^https:\/\/raw\.githubusercontent\.com\/kubernetes\/enhancements\/head1\/(.+)$/)?.[1];
      if (raw === 'keps/sig-node/753-x/kep.yaml') return new Response('title: Sidecar (updated)\nstatus: implemented\n');
      if (raw === 'keps/sig-apps/9000-new/kep.yaml') return new Response('title: Brand new\nstatus: provisional\n');
      if (raw?.endsWith('README.md')) return new Response('readme');
      return undefined;
    });

    const keps = await loadKeps();

    expect(keps.map((k) => [k.number, k.title])).toEqual([
      ['9000', 'Brand new'],
      ['753', 'Sidecar (updated)'],
    ]);
    // Snapshot + compare + raw files only; no tree or per-KEP API calls.
    const apiCalls = fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('api.github.com'));
    expect(apiCalls).toEqual(['https://api.github.com/repos/kubernetes/enhancements/compare/snap...master']);
    expect(JSON.parse(localStorage.getItem(CACHE_KEY_KEPS)!).timestamp).toBe(Date.parse('2026-10-08T12:00:00Z'));
  });

  it('shows the snapshot as-is when changes can\'t be checked', async () => {
    const generatedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    stubSnapshots({ keps: { generatedAt, commit: 'snap', data: [kep('753')] } });
    const keps = await loadKeps();
    expect(keps.map((k) => k.number)).toEqual(['753']);
    expect(JSON.parse(localStorage.getItem(CACHE_KEY_KEPS)!).timestamp).toBe(Date.parse(generatedAt));
  });

  it('adds recently changed KEPs to What\'s New', async () => {
    stubFetch((url) => {
      if (url === '/data/recent-keps.json') {
        return json({ generatedAt: new Date().toISOString(), commit: 'snap', data: [{ number: '1', date: '2026-10-01T00:00:00.000Z' }] });
      }
      if (url.includes('/compare/snap...master')) {
        return json({
          status: 'ahead',
          total_commits: 1,
          commits: [{ sha: 'h', commit: { committer: { date: '2026-10-08T11:30:00Z' } } }],
          files: [{ filename: 'keps/sig-node/753-x/README.md', status: 'modified' }],
        });
      }
      return undefined;
    });
    const changes = await loadRecentKepChanges();
    expect(changes.map((c) => [c.number, c.date.toISOString()])).toEqual([
      ['753', '2026-10-08T11:30:00.000Z'],
      ['1', '2026-10-01T00:00:00.000Z'],
    ]);
  });
});

describe('loadRecentCaepChanges', () => {
  it('serves CAEP ids from the snapshot and adds proposals changed since, including moves to archived/', async () => {
    const fetchMock = stubFetch((url) => {
      if (url === '/data/recent-caeps.json') {
        return json({
          generatedAt: new Date().toISOString(),
          commit: 'snap',
          data: [
            { number: '20240916-improve-status', date: '2026-10-02T00:00:00.000Z' },
            { number: '20200506-conditions', date: '2026-09-30T00:00:00.000Z' },
          ],
        });
      }
      if (url.endsWith('/repos/kubernetes-sigs/cluster-api/compare/snap...main')) {
        return json({
          status: 'ahead',
          total_commits: 1,
          commits: [{ sha: 'h', commit: { committer: { date: '2026-10-08T09:00:00Z' } } }],
          files: [
            { filename: 'docs/proposals/archived/20200506-conditions.md', status: 'renamed', previous_filename: 'docs/proposals/20200506-conditions.md' },
            { filename: 'docs/proposals/images/diagram.png', status: 'added' },
            { filename: 'internal/controllers/machine.go', status: 'modified' },
          ],
        });
      }
      return undefined;
    });

    const changes = await loadRecentCaepChanges();

    expect(changes.map((c) => [c.number, c.date.toISOString().slice(0, 10)])).toEqual([
      ['20200506-conditions', '2026-10-08'],
      ['20240916-improve-status', '2026-10-02'],
    ]);
    // No path-filtered commit walk: just the snapshot and one comparison.
    expect(fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('api.github.com'))).toEqual([
      'https://api.github.com/repos/kubernetes-sigs/cluster-api/compare/snap...main',
    ]);
  });

  it('fetches CAEP history live without a snapshot', async () => {
    const fetchMock = stubFetch((url) =>
      url.includes('/repos/kubernetes-sigs/cluster-api/commits?path=docs/proposals/') ? json([]) : undefined,
    );
    await expect(loadRecentCaepChanges()).resolves.toEqual([]);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('commits?path=docs/proposals/'))).toBe(true);
  });
});
