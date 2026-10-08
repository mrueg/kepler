import { describe, expect, it } from 'vitest';
import {
  clearGitHubToken,
  getGitHubToken,
  getTokenState,
  markGitHubTokenRejected,
  setGitHubToken,
  shouldSendToken,
} from './githubToken';

describe('shouldSendToken', () => {
  it('only allows HTTPS requests to api.github.com', () => {
    expect(shouldSendToken('https://api.github.com/repos/kubernetes/enhancements')).toBe(true);
    expect(shouldSendToken('https://raw.githubusercontent.com/kubernetes/enhancements/master/x')).toBe(false);
    expect(shouldSendToken('https://github.com/mrueg.png')).toBe(false);
    expect(shouldSendToken('http://api.github.com/x')).toBe(false);
    expect(shouldSendToken('https://api.github.com.evil.example/x')).toBe(false);
    expect(shouldSendToken('not a url')).toBe(false);
  });
});

describe('token store', () => {
  it('saves trimmed tokens, clears them, and tracks rejection', () => {
    setGitHubToken('  github_pat_abc \n');
    expect(getGitHubToken()).toBe('github_pat_abc');
    const first = getTokenState();
    expect(first).toEqual({ token: 'github_pat_abc', rejected: false });
    // Same snapshot object while nothing changed (required by useSyncExternalStore).
    expect(getTokenState()).toBe(first);

    markGitHubTokenRejected();
    expect(getTokenState().rejected).toBe(true);

    // Saving a new token clears the rejection.
    setGitHubToken('github_pat_new');
    expect(getTokenState()).toEqual({ token: 'github_pat_new', rejected: false });

    clearGitHubToken();
    expect(getTokenState()).toEqual({ token: null, rejected: false });
  });
});
