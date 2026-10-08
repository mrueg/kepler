'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { CACHE_KEY_KEPS } from '../api/github';
import { CACHE_KEY_GEPS } from '../api/gatewayapi';
import { readCache } from '../api/shared';
import { kepDisplayTitle } from '../utils/kep';
import { proposalHref, searchJumpTargets, type JumpTarget } from '../utils/quickJump';
import type { Kep } from '../types/kep';
import type { Gep } from '../types/gep';

/** Proposals from the cached lists; empty until a list has been loaded once. */
function loadTargets(): JumpTarget[] {
  const keps = readCache<Kep[]>(CACHE_KEY_KEPS) ?? [];
  const geps = readCache<Gep[]>(CACHE_KEY_GEPS) ?? [];
  return [
    ...keps.map((k) => ({ kind: 'KEP' as const, number: k.number, title: kepDisplayTitle(k), href: proposalHref('KEP', k.number) })),
    ...geps.map((g) => ({ kind: 'GEP' as const, number: String(g.number), title: g.name, href: proposalHref('GEP', String(g.number)) })),
  ];
}

const noopSubscribe = () => () => {};
function useShortcutLabel(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'),
    () => 'Ctrl K',
  );
}

/** Ctrl/⌘+K dialog to jump straight to a KEP or GEP by number or title. */
export function QuickJump() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [targets, setTargets] = useState<JumpTarget[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const listId = useId();
  const shortcut = useShortcutLabel();

  const results = searchJumpTargets(query, targets);

  function show() {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setTargets(loadTargets());
    setQuery('');
    setActive(0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    returnFocusRef.current?.focus();
  }

  function go(target: JumpTarget) {
    setOpen(false);
    router.push(target.href);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) close();
        else show();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function onInputKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        if (results[active]) {
          e.preventDefault();
          go(results[active]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        // Keep focus in the dialog; it has a single control.
        e.preventDefault();
        break;
    }
  }

  return (
    <>
      <button className="quick-jump-trigger" onClick={show} aria-label="Jump to a KEP or GEP" title={`Jump to… (${shortcut})`}>
        <span aria-hidden="true">⌕</span> <kbd>{shortcut}</kbd>
      </button>
      {open && (
        <div className="quick-jump-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="quick-jump" role="dialog" aria-modal="true" aria-label="Jump to a KEP or GEP">
            <input
              ref={inputRef}
              className="quick-jump-input"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
              placeholder="KEP or GEP number, or title…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
            />
            <ul id={listId} role="listbox" className="quick-jump-results" aria-label="Matches">
              {results.map((t, i) => (
                <li
                  key={`${t.kind}-${t.number}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`quick-jump-result${i === active ? ' quick-jump-result--active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(t)}
                >
                  <span className="quick-jump-number">{t.kind}-{t.number}</span>{' '}
                  <span className="quick-jump-title">{t.title || 'Open this proposal'}</span>
                </li>
              ))}
            </ul>
            {query.trim() && results.length === 0 && (
              <p className="quick-jump-empty">
                No matches{targets.length === 0 ? ' yet — titles become searchable once a list has loaded' : ''}.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
