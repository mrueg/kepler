'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { verifyGitHubToken } from '../api/token';
import {
  clearGitHubToken,
  getServerTokenState,
  getTokenState,
  onOpenTokenSettings,
  openTokenSettings,
  setGitHubToken,
  subscribeToToken,
} from '../utils/githubToken';

const CREATE_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

export function useGitHubTokenState() {
  return useSyncExternalStore(subscribeToToken, getTokenState, getServerTokenState);
}

/** Footer control plus dialog for adding, checking and removing a GitHub token. */
export function TokenSettings() {
  const { token, rejected } = useGitHubTokenState();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'checking' | 'error' | 'saved'; message?: string }>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const helpId = useId();

  function show() {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setValue('');
    setStatus({ kind: 'idle' });
    setOpen(true);
  }

  function close() {
    setOpen(false);
    returnFocusRef.current?.focus();
  }

  useEffect(() => onOpenTokenSettings(show), []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    // On the document, so Escape works even if focus left the dialog.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        returnFocusRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const candidate = value.trim();
    if (!candidate) return;
    setStatus({ kind: 'checking' });
    const result = await verifyGitHubToken(candidate);
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.message });
      return;
    }
    setGitHubToken(candidate);
    setValue('');
    setStatus({ kind: 'saved', message: `Saved. You now have ${result.remaining.toLocaleString('en-US')} of ${result.limit.toLocaleString('en-US')} requests per hour.` });
  }

  function remove() {
    clearGitHubToken();
    setStatus({ kind: 'saved', message: 'Token removed from this browser.' });
    // The Remove button disappears; keep focus inside the dialog.
    inputRef.current?.focus();
  }

  const label = rejected ? '⚠ GitHub token rejected' : token ? '🔑 Using your GitHub token' : '🔑 Add GitHub token';

  return (
    <>
      <button
        className={`token-settings-trigger${rejected ? ' token-settings-trigger--warning' : ''}`}
        onClick={show}
        title="Use your own GitHub token for a higher API rate limit"
      >
        {label}
      </button>
      {open && (
        <div className="quick-jump-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div
            className="token-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <h2 id={titleId} className="token-dialog-title">GitHub token</h2>
            <p id={helpId} className="token-dialog-text">
              Without a token, GitHub allows 60 API requests per hour per IP address. With your own token you get
              5,000. The token is stored only in this browser and sent only to <code>api.github.com</code>.
            </p>
            <ol className="token-dialog-steps">
              <li>
                <a href={CREATE_TOKEN_URL} target="_blank" rel="noopener noreferrer">
                  Create a fine-grained personal access token
                </a>
                .
              </li>
              <li>Under <strong>Repository access</strong>, choose <strong>Public repositories</strong>. Don&apos;t add any permissions.</li>
              <li>Pick a short expiration, then paste the token below.</li>
            </ol>

            {rejected && (
              <p className="token-dialog-error" role="alert">
                GitHub rejected your saved token (revoked or expired). Requests are unauthenticated until you replace or remove it.
              </p>
            )}

            <form onSubmit={save} className="token-dialog-form">
              <label htmlFor={`${titleId}-input`} className="token-dialog-label">
                {token ? 'Replace token' : 'Token'}
              </label>
              <input
                id={`${titleId}-input`}
                ref={inputRef}
                className="token-dialog-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="github_pat_…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-describedby={helpId}
              />
              <div className="token-dialog-actions">
                <button type="submit" className="retry-btn" disabled={!value.trim() || status.kind === 'checking'}>
                  {status.kind === 'checking' ? 'Checking…' : 'Save'}
                </button>
                {token && (
                  <button type="button" className="clear-btn" onClick={remove}>
                    Remove token
                  </button>
                )}
                <button type="button" className="clear-btn" onClick={close}>
                  Close
                </button>
              </div>
            </form>
            {status.kind === 'error' && <p className="token-dialog-error" role="alert">{status.message}</p>}
            {status.kind === 'saved' && <p className="token-dialog-success" role="status">{status.message}</p>}
          </div>
        </div>
      )}
    </>
  );
}

/** Shown next to rate-limit errors when no token is set. */
export function RateLimitHelp({ error }: { error: string | null }) {
  const { token } = useGitHubTokenState();
  if (!error || !/rate limit/i.test(error) || token) return null;
  return (
    <button className="retry-btn" onClick={openTokenSettings}>
      Use a GitHub token
    </button>
  );
}
