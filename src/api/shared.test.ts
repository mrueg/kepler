import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cachedPRStatus,
  fetchCIStatus,
  fetchRecentlyChanged,
  fetchReviewStatus,
  getCached,
  setCache,
  type PRInfo,
} from './shared';
import { json, stubFetch } from '../test/fetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubReviews(reviews: { state: string; login: string }[]) {
  stubFetch((url) =>
    url.endsWith('/pulls/1/reviews')
      ? json(reviews.map(({ state, login }) => ({ state, user: { login } })))
      : undefined,
  );
}

describe('fetchReviewStatus', () => {
  it('uses the latest actionable review per reviewer', () => {
    stubReviews([
      { state: 'CHANGES_REQUESTED', login: 'alice' },
      { state: 'COMMENTED', login: 'alice' },
      { state: 'APPROVED', login: 'alice' },
    ]);
    return expect(fetchReviewStatus('o/r', 1, false)).resolves.toBe('approved');
  });

  it('reports changes requested if any reviewer still requests changes', () => {
    stubReviews([
      { state: 'APPROVED', login: 'alice' },
      { state: 'CHANGES_REQUESTED', login: 'bob' },
    ]);
    return expect(fetchReviewStatus('o/r', 1, false)).resolves.toBe('changes_requested');
  });

  it('is pending with only comments on an unmerged PR, none once merged', async () => {
    stubReviews([{ state: 'COMMENTED', login: 'alice' }]);
    await expect(fetchReviewStatus('o/r', 1, false)).resolves.toBe('pending');
    await expect(fetchReviewStatus('o/r', 1, true)).resolves.toBe('none');
  });

  it('is undefined when the request fails, so callers can tell it apart from "none"', () => {
    stubFetch(() => undefined);
    return expect(fetchReviewStatus('o/r', 1, false)).resolves.toBeUndefined();
  });
});

describe('fetchCIStatus', () => {
  function stubRuns(runs: { status: string; conclusion: string | null }[]) {
    stubFetch((url) => (url.endsWith('/commits/abc/check-runs') ? json({ check_runs: runs }) : undefined));
  }

  it('is unknown without check runs', () => {
    stubRuns([]);
    return expect(fetchCIStatus('o/r', 'abc')).resolves.toBe('unknown');
  });

  it('is pending while any run is incomplete', () => {
    stubRuns([{ status: 'completed', conclusion: 'success' }, { status: 'in_progress', conclusion: null }]);
    return expect(fetchCIStatus('o/r', 'abc')).resolves.toBe('pending');
  });

  it('treats skipped and neutral runs as passing', () => {
    stubRuns([
      { status: 'completed', conclusion: 'success' },
      { status: 'completed', conclusion: 'skipped' },
      { status: 'completed', conclusion: 'neutral' },
    ]);
    return expect(fetchCIStatus('o/r', 'abc')).resolves.toBe('success');
  });

  it('is undefined when the request fails', () => {
    stubFetch(() => undefined);
    return expect(fetchCIStatus('o/r', 'abc')).resolves.toBeUndefined();
  });

  it('fails if any run failed', () => {
    stubRuns([{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'failure' }]);
    return expect(fetchCIStatus('o/r', 'abc')).resolves.toBe('failure');
  });
});

describe('getCached', () => {
  it('returns data only while younger than the TTL', () => {
    vi.useFakeTimers({ now: 0 });
    try {
      setCache('k', [1, 2]);
      vi.setSystemTime(999);
      expect(getCached('k', 1000)).toEqual([1, 2]);
      vi.setSystemTime(1000);
      expect(getCached('k', 1000)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('fetchRecentlyChanged', () => {
  const PATTERN = /^keps\/sig-[^/]+\/(\d+)-[^/]+\//;
  const file = (n: string) => ({ filename: `keps/sig-node/${n}-x/README.md` });

  it('walks merged PRs in merge order, one request per PR, dated by merge time', async () => {
    const fetchMock = stubFetch((url) => {
      if (url.includes('/pulls?state=closed')) {
        return json([
          { number: 1, merged_at: '2026-01-01T00:00:00Z' },
          { number: 2, merged_at: null }, // closed without merging
          { number: 3, merged_at: '2026-01-03T00:00:00Z' },
          { number: 4, merged_at: '2026-01-02T00:00:00Z' },
        ]);
      }
      const files: Record<string, unknown[]> = {
        '/pulls/3/files': [file('30'), file('31')],
        '/pulls/4/files': [file('30'), { filename: 'README.md' }],
        '/pulls/1/files': [file('10')],
      };
      const match = Object.entries(files).find(([path]) => url.includes(path));
      return match ? json(match[1]) : undefined;
    });

    const changes = await fetchRecentlyChanged('o/r', 'keps/', PATTERN, 'k', 'merged-pulls', 2);

    expect(changes.map((c) => [c.number, c.date.toISOString().slice(0, 10)])).toEqual([
      ['30', '2026-01-03'],
      ['31', '2026-01-03'],
    ]);
    // The PR list, then the first batch of PR file lists; no per-commit requests.
    expect(fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/commits'))).toEqual([]);
  });

  it('uses path-filtered commits dated by when they landed', async () => {
    stubFetch((url) => {
      if (url.includes('/commits?path=keps/')) {
        return json([
          { sha: 'b', commit: { committer: { date: '2026-02-02T00:00:00Z' } } },
          { sha: 'a', commit: { committer: { date: '2026-02-01T00:00:00Z' } } },
        ]);
      }
      if (url.endsWith('/commits/b')) return json({ files: [file('20')] });
      if (url.endsWith('/commits/a')) return json({ files: [file('20'), file('10')] });
      return undefined;
    });

    const changes = await fetchRecentlyChanged('o/r', 'keps/', PATTERN, 'k', 'commits');

    expect(changes.map((c) => [c.number, c.date.toISOString().slice(0, 10)])).toEqual([
      ['20', '2026-02-02'],
      ['10', '2026-02-01'],
    ]);
    expect(getCached('k', 60_000)).not.toBeNull();
  });

  it('returns partial results but does not cache them when a request fails', async () => {
    stubFetch((url) => {
      if (url.includes('/commits?path=')) {
        return json([
          { sha: 'b', commit: { committer: { date: '2026-02-02T00:00:00Z' } } },
          { sha: 'a', commit: { committer: { date: '2026-02-01T00:00:00Z' } } },
        ]);
      }
      if (url.endsWith('/commits/a')) return json({ files: [file('10')] });
      return new Response('rate limited', { status: 403 });
    });

    const changes = await fetchRecentlyChanged('o/r', 'keps/', PATTERN, 'k', 'commits');

    expect(changes.map((c) => c.number)).toEqual(['10']);
    expect(getCached('k', 60_000)).toBeNull();
  });
});

describe('cachedPRStatus', () => {
  const pr = (number: number): PRInfo => ({
    number,
    title: `PR ${number}`,
    state: 'open',
    html_url: '',
    draft: false,
    merged_at: null,
    user: { login: 'x' },
    ciStatus: 'success',
    reviewStatus: 'approved',
  });

  it('serves repeat lookups from the cache for 20 minutes', async () => {
    vi.useFakeTimers({ now: 0 });
    try {
      const load = vi.fn(async () => ({ data: [pr(1)], complete: true }));
      await cachedPRStatus('o/r#1', load);
      vi.setSystemTime(19 * 60 * 1000);
      await expect(cachedPRStatus('o/r#1', load)).resolves.toEqual([pr(1)]);
      expect(load).toHaveBeenCalledTimes(1);

      vi.setSystemTime(21 * 60 * 1000);
      await cachedPRStatus('o/r#1', load);
      expect(load).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns incomplete results without caching them', async () => {
    const load = vi.fn(async () => ({ data: [pr(1)], complete: false }));
    await expect(cachedPRStatus('o/r#1', load)).resolves.toEqual([pr(1)]);
    await cachedPRStatus('o/r#1', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('falls back to stale data when loading fails entirely', async () => {
    vi.useFakeTimers({ now: 0 });
    try {
      await expect(cachedPRStatus('o/r#1', async () => null)).resolves.toEqual([]);
      await cachedPRStatus('o/r#1', async () => ({ data: [pr(1)], complete: true }));
      vi.setSystemTime(30 * 60 * 1000);
      await expect(cachedPRStatus('o/r#1', async () => null)).resolves.toEqual([pr(1)]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops expired entries when writing', async () => {
    vi.useFakeTimers({ now: 0 });
    try {
      await cachedPRStatus('o/r#1', async () => ({ data: [pr(1)], complete: true }));
      vi.setSystemTime(30 * 60 * 1000);
      await cachedPRStatus('o/r#2', async () => ({ data: [pr(2)], complete: true }));
      const stored = JSON.parse(localStorage.getItem('kepler_pr_status_v1')!).data;
      expect(Object.keys(stored)).toEqual(['o/r#2']);
    } finally {
      vi.useRealTimers();
    }
  });
});
