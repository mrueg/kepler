// An optional GitHub token the user pastes in, so API requests count against
// their own 5,000/hour limit instead of the 60/hour unauthenticated per-IP one.
// It's stored only in this browser and sent only to api.github.com.

const STORAGE_KEY = 'kepler_github_token';
const CHANGE_EVENT = 'kepler-github-token-change';
const OPEN_SETTINGS_EVENT = 'kepler-open-token-settings';

export interface TokenState {
  token: string | null;
  /** GitHub answered 401 for the stored token (revoked or expired). */
  rejected: boolean;
}

let rejected = false;
let snapshot: TokenState = { token: null, rejected: false };

function notify(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getGitHubToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setGitHubToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token.trim());
  } catch {
    // Storage unavailable: the token can't be remembered.
  }
  rejected = false;
  notify();
}

export function clearGitHubToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  rejected = false;
  notify();
}

export function markGitHubTokenRejected(): void {
  if (rejected) return;
  rejected = true;
  notify();
}

/** Stable snapshot for useSyncExternalStore. */
export function getTokenState(): TokenState {
  const token = getGitHubToken();
  if (token !== snapshot.token || rejected !== snapshot.rejected) snapshot = { token, rejected };
  return snapshot;
}

const SERVER_STATE: TokenState = { token: null, rejected: false };
export function getServerTokenState(): TokenState {
  return SERVER_STATE;
}

export function subscribeToToken(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Saved or removed in another tab.
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Opens the token settings dialog from anywhere (e.g. a rate-limit error). */
export function openTokenSettings(): void {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

export function onOpenTokenSettings(listener: () => void): () => void {
  window.addEventListener(OPEN_SETTINGS_EVENT, listener);
  return () => window.removeEventListener(OPEN_SETTINGS_EVENT, listener);
}

/** Only GitHub's API gets the token; never raw.githubusercontent.com or other hosts. */
export function shouldSendToken(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'api.github.com';
  } catch {
    return false;
  }
}
