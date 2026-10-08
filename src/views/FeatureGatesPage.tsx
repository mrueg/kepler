'use client';

import { useDeferredValue, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { UseProposalsResult } from '../hooks/useProposals';
import { useUrlSync } from '../hooks/useUrlSync';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { LoadStatus } from '../components/LoadingBar';
import { StageBadge, StatusBadge } from '../components/Badges';
import { disableSupportedLabel } from '../components/FeatureGateList';
import { formatSig, kepDisplayTitle, listFeatureGates } from '../utils/kep';
import type { Kep } from '../types/kep';

/** Searchable index of every feature gate declared in a kep.yaml. */
export function FeatureGatesPage({ data }: { data: UseProposalsResult<Kep> }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('gate') ?? '');
  const deferredQuery = useDeferredValue(query);
  const searchRef = useRef<HTMLInputElement>(null);

  const urlParams = new URLSearchParams({ tab: 'gates' });
  if (query) urlParams.set('gate', query);
  useUrlSync(urlParams, '/');

  const focusSearch = useCallback((e: KeyboardEvent) => {
    if (e.key === '/') {
      e.preventDefault();
      searchRef.current?.focus();
    }
  }, []);
  useKeyboardShortcut(focusSearch);

  const gates = useMemo(() => listFeatureGates(data.items), [data.items]);
  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return gates;
    return gates.filter(
      (g) => g.name.toLowerCase().includes(q) || g.components.some((c) => c.toLowerCase().includes(q)),
    );
  }, [gates, deferredQuery]);

  return (
    <div className="list-page">
      <div className="search-filter-bar">
        <input
          ref={searchRef}
          type="search"
          className="search-input"
          placeholder="Search feature gates by name or component…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search feature gates"
        />
      </div>

      <LoadStatus {...data} noun="KEPs" />

      {!data.loading && !data.error && (
        <>
          <div className="results-header">
            <span>
              {filtered.length} feature gate{filtered.length !== 1 ? 's' : ''}
              {deferredQuery.trim() && ' matching'}
            </span>
          </div>
          <div className="kep-table-wrapper">
            <table className="kep-table">
              <thead>
                <tr>
                  <th className="kep-table-th">Feature gate</th>
                  <th className="kep-table-th kep-table-th-title">KEP</th>
                  <th className="kep-table-th kep-table-th-stage">Stage</th>
                  <th className="kep-table-th">Components</th>
                  <th className="kep-table-th" title="Whether the feature can be disabled after it was enabled">
                    Can disable
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ name, components, kep }) => (
                  <tr key={`${name}-${kep.number}`} className="kep-table-row">
                    <td className="kep-table-td">
                      <code className="feature-gate-name">{name}</code>
                    </td>
                    <td className="kep-table-td kep-table-td-title">
                      <Link href={`/kep?number=${kep.number}`} className="kep-table-title-link">
                        KEP-{kep.number}: {kepDisplayTitle(kep)}
                      </Link>
                      <div className="feature-gate-meta">
                        {formatSig(kep.sig)} <StatusBadge status={kep.status} />
                      </div>
                    </td>
                    <td className="kep-table-td kep-table-td-stage">
                      <StageBadge stage={kep.stage} />
                    </td>
                    <td className="kep-table-td feature-gate-components">{components.join(', ') || '—'}</td>
                    <td className="kep-table-td">{disableSupportedLabel(kep['disable-supported']) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
