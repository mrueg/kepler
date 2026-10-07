import { afterEach, describe, expect, it, vi } from 'vitest';
import { githubFetch } from './githubFetch';
import { stubFetch } from '../test/fetch';

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
