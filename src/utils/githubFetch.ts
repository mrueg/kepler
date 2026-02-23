const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

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

/**
 * A drop-in replacement for `fetch` that automatically retries on GitHub
 * rate-limit responses (HTTP 429 and secondary-rate-limit 403).
 *
 * On a rate-limit response the function waits for the delay indicated by
 * the `Retry-After` or `x-ratelimit-reset` response headers, or falls back
 * to exponential backoff, then retries up to `MAX_RETRIES` times.
 */
export async function githubFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let response: Response | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    response = await fetch(input, init);

    const isRateLimited =
      response.status === 429 ||
      (response.status === 403 &&
        response.headers.get('x-ratelimit-remaining') === '0');

    if (!isRateLimited || attempt === MAX_RETRIES) {
      return response;
    }

    const delay = getRateLimitDelay(response, attempt);
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
  // This is unreachable but satisfies TypeScript
  return response!;
}
