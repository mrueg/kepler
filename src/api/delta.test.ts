import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyChanges, applyRecentChanges, fetchChangesSince, type DeltaSource } from './delta';
import { NotFoundError } from './shared';
import { kepPathForFile, KEP_FILE_PATTERN } from './github';
import { gepPathForFile } from './gatewayapi';
import { json, stubFetch } from '../test/fetch';

afterEach(() => {
  vi.useRealTimers();
});

describe('file to proposal mapping', () => {
  it('maps any file in a KEP or GEP folder to its metadata file', () => {
    expect(kepPathForFile('keps/sig-node/753-sidecar/README.md')).toBe('keps/sig-node/753-sidecar/kep.yaml');
    expect(kepPathForFile('keps/sig-node/753-sidecar/kep.yaml')).toBe('keps/sig-node/753-sidecar/kep.yaml');
    expect(kepPathForFile('keps/sig-node/README.md')).toBeNull();
    expect(kepPathForFile('keps/prod-readiness/sig-node/753.yaml')).toBeNull();
    expect(gepPathForFile('geps/gep-1709/index.md')).toBe('geps/gep-1709/metadata.yaml');
    expect(gepPathForFile('site-src/index.md')).toBeNull();
  });
});

interface Item { path: string; v: string }

function source(files: Record<string, string | Error>): DeltaSource<Item> & { fetchItem: ReturnType<typeof vi.fn> } {
  return {
    proposalPathFor: (f) => (f.startsWith('p/') ? f.replace(/\/[^/]+$/, '/meta') : null),
    fetchItem: vi.fn(async (path: string) => {
      const v = files[path];
      if (v === undefined) throw new NotFoundError(path);
      if (v instanceof Error) throw v;
      return { path, v };
    }),
    compare: (a, b) => a.path.localeCompare(b.path),
  };
}

describe('applyChanges', () => {
  const items = [
    { path: 'p/a/meta', v: 'a1' },
    { path: 'p/b/meta', v: 'b1' },
    { path: 'p/c/meta', v: 'c1' },
  ];

  it('re-fetches modified, adds new, removes deleted and renamed proposals, once each', async () => {
    const src = source({ 'p/a/meta': 'a2', 'p/d/meta': 'd1', 'p/e/meta': 'e1' });
    const result = await applyChanges(items, [
      { filename: 'p/a/README.md', status: 'modified' },
      { filename: 'p/a/meta', status: 'modified' },
      { filename: 'p/d/meta', status: 'added' },
      { filename: 'p/b/meta', status: 'removed' },
      { filename: 'p/e/meta', status: 'renamed', previous_filename: 'p/c/meta' },
      { filename: 'docs/unrelated.md', status: 'modified' },
    ], src, 'abc123');

    expect(result).toEqual({
      complete: true,
      items: [
        { path: 'p/a/meta', v: 'a2' },
        { path: 'p/d/meta', v: 'd1' },
        { path: 'p/e/meta', v: 'e1' },
      ],
    });
    expect(src.fetchItem).toHaveBeenCalledTimes(5);
    expect(src.fetchItem).toHaveBeenCalledWith('p/a/meta', 'abc123');
  });

  it('keeps the old entry when a re-fetch fails for another reason', async () => {
    const src = source({ 'p/a/meta': new Error('rate limited') });
    const result = await applyChanges(items, [{ filename: 'p/a/meta', status: 'modified' }], src, 'abc');
    expect(result.complete).toBe(false);
    expect(result.items).toEqual(items);
  });

  it('returns the list untouched when nothing relevant changed', async () => {
    const src = source({});
    const result = await applyChanges(items, [{ filename: 'README.md', status: 'modified' }], src, 'abc');
    expect(result.items).toBe(items);
    expect(src.fetchItem).not.toHaveBeenCalled();
  });
});

describe('applyRecentChanges', () => {
  const recent = [
    { number: '1', date: new Date('2026-10-01') },
    { number: '2', date: new Date('2026-09-30') },
  ];

  it('moves changed proposals to the top with the newest commit date', () => {
    const date = new Date('2026-10-08');
    const result = applyRecentChanges(recent, [
      { filename: 'keps/sig-node/2-x/README.md', status: 'modified' },
      { filename: 'keps/sig-node/753-y/kep.yaml', status: 'added' },
      { filename: 'keps/sig-node/753-y/README.md', status: 'added' },
    ], KEP_FILE_PATTERN, date, 3);
    expect(result).toEqual([
      { number: '2', date },
      { number: '753', date },
      { number: '1', date: new Date('2026-10-01') },
    ]);
  });

  it('leaves the list alone without relevant changes', () => {
    expect(applyRecentChanges(recent, [{ filename: 'Makefile', status: 'modified' }], KEP_FILE_PATTERN, new Date())).toBe(recent);
  });
});

describe('fetchChangesSince', () => {
  const commit = (sha: string, date: string) => ({ sha, commit: { committer: { date } } });

  it('returns changed files, the head commit and newest date, and caches for 10 minutes', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T12:00:00Z') });
    const fetchMock = stubFetch((url) =>
      url.endsWith('/repos/o/r/compare/base...main')
        ? json({
            status: 'ahead',
            total_commits: 2,
            commits: [commit('c1', '2026-10-08T10:00:00Z'), commit('c2', '2026-10-08T11:00:00Z')],
            files: [{ filename: 'keps/x', status: 'renamed', previous_filename: 'keps/y', patch: '@@ big diff @@' }],
          })
        : undefined,
    );

    const result = await fetchChangesSince('o/r', 'base', 'main');
    expect(result).toMatchObject({
      head: 'c2',
      latestCommitDate: '2026-10-08T11:00:00Z',
      complete: true,
      files: [{ filename: 'keps/x', status: 'renamed', previous_filename: 'keps/y' }],
    });
    // Patches aren't kept in the cache.
    expect(localStorage.getItem('kepler_compare_v1')).not.toContain('big diff');

    await fetchChangesSince('o/r', 'base', 'main');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-10-08T12:11:00Z'));
    await fetchChangesSince('o/r', 'base', 'main');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('handles no changes, truncated comparisons, rewritten history and errors', async () => {
    stubFetch((url) => {
      if (url.includes('/compare/same...')) return json({ status: 'identical', total_commits: 0, commits: [] });
      if (url.includes('/compare/old...')) return json({ status: 'ahead', total_commits: 400, commits: [commit('x', '2026-10-08T00:00:00Z')], files: [] });
      if (url.includes('/compare/gone...')) return json({ status: 'diverged', total_commits: 1, commits: [], files: [] });
      return undefined;
    });
    await expect(fetchChangesSince('o/r', 'same', 'main')).resolves.toMatchObject({ head: 'same', files: [], complete: true });
    await expect(fetchChangesSince('o/r', 'old', 'main')).resolves.toMatchObject({ complete: false });
    await expect(fetchChangesSince('o/r', 'gone', 'main')).resolves.toBeNull();
    await expect(fetchChangesSince('o/r', 'missing', 'main')).resolves.toBeNull();
  });
});
