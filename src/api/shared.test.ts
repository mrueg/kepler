import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCIStatus, fetchReviewStatus, getCached, setCache } from './shared';
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

  it('is none when the request fails', () => {
    stubFetch(() => undefined);
    return expect(fetchReviewStatus('o/r', 1, false)).resolves.toBe('none');
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
