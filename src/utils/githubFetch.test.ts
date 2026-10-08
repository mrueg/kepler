import { afterEach, describe, expect, it, vi } from 'vitest';
import { githubFetch } from './githubFetch';
import { stubFetch } from '../test/fetch';
import { clearGitHubToken, getTokenState, setGitHubToken } from './githubToken';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function rateLimited(headers: Record<string, string>): Response {
  return new Response('rate limited', { status: 403, headers: { 'x-ratelimit-remaining': '0', ...headers } });
}

describe('githubFetch', () => {
  it('returns non-rate-limited responses as-is', async () => {
    const fetchMock = stubFetch(() => new Response('ok'));
    const response = await githubFetch('https://api.github.com/x');
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails fast when the rate limit resets far in the future', async () => {
    const reset = String(Math.floor(Date.now() / 1000) + 30 * 60);
    const fetchMock = stubFetch(() => rateLimited({ 'x-ratelimit-reset': reset }));
    const response = await githubFetch('https://api.github.com/x');
    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries after a short Retry-After delay', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetchMock = stubFetch(() => (++calls === 1 ? rateLimited({ 'Retry-After': '2' }) : new Response('ok')));

    const pending = githubFetch('https://api.github.com/x');
    await vi.advanceTimersByTimeAsync(2000);
    const response = await pending;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('githubFetch with a GitHub token', () => {
  const authOf = (call: unknown[]) => new Headers((call[1] as RequestInit | undefined)?.headers).get('Authorization');

  it('sends the token to api.github.com only', async () => {
    setGitHubToken('github_pat_secret');
    try {
      const fetchMock = stubFetch(() => new Response('ok'));
      await githubFetch('https://api.github.com/repos/o/r', { headers: { Accept: 'application/json' } });
      await githubFetch('https://raw.githubusercontent.com/o/r/main/file.md');

      expect(authOf(fetchMock.mock.calls[0])).toBe('Bearer github_pat_secret');
      expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get('Accept')).toBe('application/json');
      expect(authOf(fetchMock.mock.calls[1])).toBeNull();
    } finally {
      clearGitHubToken();
    }
  });

  it('sends nothing without a token', async () => {
    const fetchMock = stubFetch(() => new Response('ok'));
    await githubFetch('https://api.github.com/repos/o/r');
    expect(authOf(fetchMock.mock.calls[0])).toBeNull();
  });

  it('marks a rejected token and retries without it', async () => {
    setGitHubToken('github_pat_revoked');
    try {
      const fetchMock = stubFetch((_url, init) =>
        new Headers(init?.headers).has('Authorization') ? new Response('bad credentials', { status: 401 }) : new Response('ok'),
      );

      const response = await githubFetch('https://api.github.com/repos/o/r');

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getTokenState().rejected).toBe(true);
    } finally {
      clearGitHubToken();
    }
  });
});
