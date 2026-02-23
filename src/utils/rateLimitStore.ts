export interface RateLimitInfo {
  remaining: number | null;
  limit: number | null;
  reset: Date | null;
  isRateLimited: boolean;
}

const RATE_LIMIT_EVENT = 'ratelimitchange';

let _info: RateLimitInfo = {
  remaining: null,
  limit: null,
  reset: null,
  isRateLimited: false,
};

export function updateRateLimit(info: Partial<RateLimitInfo>): void {
  _info = { ..._info, ...info };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RATE_LIMIT_EVENT, { detail: _info }));
  }
}

export function getRateLimitInfo(): RateLimitInfo {
  return _info;
}

export function onRateLimitChange(
  listener: (info: RateLimitInfo) => void,
): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<RateLimitInfo>).detail);
  window.addEventListener(RATE_LIMIT_EVENT, handler);
  return () => window.removeEventListener(RATE_LIMIT_EVENT, handler);
}
