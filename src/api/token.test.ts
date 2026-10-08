import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyGitHubToken } from './token';
import { getRateLimitInfo } from '../utils/rateLimitStore';
import { json, stubFetch } from '../test/fetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('verifyGitHubToken', () => {
  it('reports the rate limit the token grants and updates the indicator', async () => {
    const fetchMock = stubFetch((url) =>
      url === 'https://api.github.com/rate_limit'
        ? json({ resources: { core: { limit: 5000, remaining: 4999, reset: 1_800_000_000 } } })
        : undefined,
    );

    await expect(verifyGitHubToken(' github_pat_x ')).resolves.toMatchObject({ ok: true, limit: 5000, remaining: 4999 });
    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get('Authorization')).toBe('Bearer github_pat_x');
    expect(getRateLimitInfo()).toMatchObject({ limit: 5000, remaining: 4999 });
  });

  it('explains invalid tokens and network errors', async () => {
    stubFetch(() => new Response('', { status: 401 }));
    await expect(verifyGitHubToken('nope')).resolves.toMatchObject({ ok: false, reason: 'invalid' });

    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));
    await expect(verifyGitHubToken('x')).resolves.toMatchObject({ ok: false, reason: 'error' });
  });
});
