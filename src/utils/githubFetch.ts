import { updateRateLimit } from './rateLimitStore';
import { getGitHubToken, markGitHubTokenRejected, shouldSendToken } from './githubToken';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
// Don't wait longer than this for a rate limit to reset; fail fast instead so
// the UI can surface the error rather than hanging for up to an hour.
const MAX_RETRY_DELAY_MS = 60 * 1000;

/**
 * Reads GitHub rate-limit headers from a response and updates the shared store.
 */
function captureRateLimitHeaders(response: Response, isRateLimited: boolean): void {
  // Rate limit headers are only meaningful in a browser context where the
  // shared store and CustomEvent dispatch are available.
  if (typeof window === 'undefined') return;
  // Only GitHub API responses carry these headers (raw.githubusercontent.com
  // does not); skip others so they don't wipe the last known values.
  if (!response.headers.has('x-ratelimit-remaining') && !isRateLimited) return;
  const remainingRaw = response.headers.get('x-ratelimit-remaining');
  const limitRaw = response.headers.get('x-ratelimit-limit');
  const resetRaw = response.headers.get('x-ratelimit-reset');
  const remaining = remainingRaw !== null ? parseInt(remainingRaw, 10) : null;
  const limit = limitRaw !== null ? parseInt(limitRaw, 10) : null;
  const reset = resetRaw !== null ? new Date(parseInt(resetRaw, 10) * 1000) : null;
  updateRateLimit({ remaining, limit, reset, isRateLimited });
}

/**
 * Calculates the delay in milliseconds before retrying a rate-limited request.
 * Respects `Retry-After` and `x-ratelimit-reset` headers; falls back to
 * exponential backoff based on the attempt number.
 */
function getRateLimitDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = parseFloat(retryAfter);
    if (!isNaN(seconds)) return seconds * 1000;
    const retryDate = Date.parse(retryAfter);
    if (!isNaN(retryDate)) return Math.max(0, retryDate - Date.now());
  }

  const resetHeader = response.headers.get('x-ratelimit-reset');
  if (resetHeader) {
    const resetMs = parseInt(resetHeader, 10) * 1000;
    if (!isNaN(resetMs)) return Math.max(0, resetMs - Date.now());
  }

  // Exponential backoff: 1s, 2s, 4s, …
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

function withAuthorization(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

async function githubFetchUnauthenticated(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  captureRateLimitHeaders(response, response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0');
  return response;
}

/**
 * A drop-in replacement for `fetch` that automatically retries on GitHub
 * rate-limit responses (HTTP 429 and secondary-rate-limit 403).
 *
 * On a rate-limit response the function waits for the delay indicated by
 * the `Retry-After` or `x-ratelimit-reset` response headers, or falls back
 * to exponential backoff, then retries up to `MAX_RETRIES` times. If the
 * required delay exceeds `MAX_RETRY_DELAY_MS`, the rate-limited response is
 * returned immediately.
 *
 * Requests to api.github.com carry the user's GitHub token when one is set.
 */
export async function githubFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = input instanceof Request ? input.url : input.toString();
  const token = shouldSendToken(url) ? getGitHubToken() : null;
  const requestInit = token ? withAuthorization(init, token) : init;

  let response: Response | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    response = await fetch(input, requestInit);

    if (token && response.status === 401) {
      // Revoked or expired: tell the user, and retry once without it so the
      // page still loads within the unauthenticated limit.
      markGitHubTokenRejected();
      return githubFetchUnauthenticated(input, init);
    }

    const isRateLimited =
      response.status === 429 ||
      (response.status === 403 &&
        response.headers.get('x-ratelimit-remaining') === '0');

    const delay = isRateLimited ? getRateLimitDelay(response, attempt) : 0;
    if (!isRateLimited || attempt === MAX_RETRIES || delay > MAX_RETRY_DELAY_MS) {
      captureRateLimitHeaders(response, isRateLimited);
      return response;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
  // This is unreachable but satisfies TypeScript
  return response!;
}
