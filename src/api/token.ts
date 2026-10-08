import { updateRateLimit } from '../utils/rateLimitStore';

export type TokenCheck =
  | { ok: true; limit: number; remaining: number; reset: Date }
  | { ok: false; reason: 'invalid' | 'error'; message: string };

/**
 * Checks a token against GitHub's /rate_limit endpoint, which doesn't count
 * against the rate limit itself, and reports the limit it grants.
 */
export async function verifyGitHubToken(token: string): Promise<TokenCheck> {
  try {
    const resp = await fetch('https://api.github.com/rate_limit', {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    if (resp.status === 401) {
      return { ok: false, reason: 'invalid', message: 'GitHub rejected this token. Check that it was copied completely and hasn’t expired.' };
    }
    if (!resp.ok) return { ok: false, reason: 'error', message: `GitHub API error: ${resp.status}` };
    const { resources } = (await resp.json()) as {
      resources: { core: { limit: number; remaining: number; reset: number } };
    };
    const { limit, remaining, reset } = resources.core;
    const result = { ok: true as const, limit, remaining, reset: new Date(reset * 1000) };
    updateRateLimit({ limit, remaining, reset: result.reset, isRateLimited: remaining === 0 });
    return result;
  } catch {
    return { ok: false, reason: 'error', message: 'Couldn’t reach GitHub. Check your connection and try again.' };
  }
}
