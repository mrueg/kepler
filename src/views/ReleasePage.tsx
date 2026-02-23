'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useKeps } from '../hooks/useKeps';
import { LoadingBar } from '../components/LoadingBar';
import { KepCard } from '../components/KepCard';
import { KepTable, type SortKey } from '../components/KepTable';
import type { Kep } from '../types/kep';

function normalizeVersion(v: string | undefined): string | null {
  if (!v) return null;
  const match = v.replace(/^v/, '').match(/^(\d+\.\d+)/);
  return match ? match[1] : null;
}

interface ReleaseGroup {
  label: string;
  description: string;
  keps: Kep[];
  stage: 'alpha' | 'beta' | 'stable';
}

export function ReleasePage() {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const { keps, loading, progress, error, reload } = useKeps();

  const allVersions = useMemo(() => {
    const versions = new Set<string>();
    for (const kep of keps) {
      const alpha = normalizeVersion(kep.milestone?.alpha);
      const beta = normalizeVersion(kep.milestone?.beta);
      const stable = normalizeVersion(kep.milestone?.stable);
      if (alpha) versions.add(alpha);
      if (beta) versions.add(beta);
      if (stable) versions.add(stable);
    }
    return Array.from(versions)
      .map((v): [string, number, number] => {
        const [maj, min] = v.split('.').map(Number);
        return [v, maj, min];
      })
      .sort(([, aMaj, aMin], [, bMaj, bMin]) =>
        aMaj !== bMaj ? aMaj - bMaj : aMin - bMin,
      )
      .map(([v]) => v);
  }, [keps]);

  const [manualVersion, setManualVersion] = useState<string>(
    searchParams.get('v') ?? '',
  );
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortKey, setSortKey] = useState<SortKey | undefined>(undefined);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  // Derive the effective version: use manual selection if set, otherwise default to latest
  const selectedVersion =
    manualVersion || (allVersions.length > 0 ? allVersions[allVersions.length - 1] : '');

  useEffect(() => {
    if (selectedVersion) {
      const params = new URLSearchParams();
      params.set('v', selectedVersion);
      const newSearch = `?${params.toString()}`;
      if (typeof window !== 'undefined' && newSearch !== window.location.search) {
        replace(newSearch, { scroll: false });
      }
    }
  }, [selectedVersion, replace]);

  const releaseGroups = useMemo((): ReleaseGroup[] => {
    if (!selectedVersion) return [];

    const introduced: Kep[] = [];
    const betaGrads: Kep[] = [];
    const stableGrads: Kep[] = [];

    for (const kep of keps) {
      if (normalizeVersion(kep.milestone?.stable) === selectedVersion) stableGrads.push(kep);
      if (normalizeVersion(kep.milestone?.beta) === selectedVersion) betaGrads.push(kep);
      if (normalizeVersion(kep.milestone?.alpha) === selectedVersion) introduced.push(kep);
    }

    return [
      {
        label: 'Graduated to Stable',
        description: `KEPs that reached stable in v${selectedVersion}`,
        keps: stableGrads,
        stage: 'stable' as const,
      },
      {
        label: 'Graduated to Beta',
        description: `KEPs that reached beta in v${selectedVersion}`,
        keps: betaGrads,
        stage: 'beta' as const,
      },
      {
        label: 'Introduced (Alpha)',
        description: `KEPs that entered alpha in v${selectedVersion}`,
        keps: introduced,
        stage: 'alpha' as const,
      },
    ].filter((g) => g.keps.length > 0);
  }, [keps, selectedVersion]);

  const totalKeps = useMemo(() => {
    if (!selectedVersion) return 0;
    const seen = new Set<string>();
    for (const group of releaseGroups) {
      for (const kep of group.keps) seen.add(kep.number);
    }
    return seen.size;
  }, [releaseGroups, selectedVersion]);

  const sortedGroups = useMemo(() => {
    if (!sortKey) return releaseGroups;
    return releaseGroups.map((group) => ({
      ...group,
      keps: [...group.keps].sort((a, b) => {
        let av = '';
        let bv = '';
        if (sortKey === 'title') {
          av = (a.title || a.slug).toLowerCase();
          bv = (b.title || b.slug).toLowerCase();
        } else if (sortKey === 'sig') {
          av = a.sig.toLowerCase();
          bv = b.sig.toLowerCase();
        } else if (sortKey === 'status') {
          av = (a.status ?? '').toLowerCase();
          bv = (b.status ?? '').toLowerCase();
        } else if (sortKey === 'stage') {
          av = (a.stage ?? '').toLowerCase();
          bv = (b.stage ?? '').toLowerCase();
        } else if (sortKey === 'last-updated') {
          av = (a['last-updated'] ?? a['creation-date'] ?? '').toLowerCase();
          bv = (b['last-updated'] ?? b['creation-date'] ?? '').toLowerCase();
        }
        const cmp = av.localeCompare(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      }),
    }));
  }, [releaseGroups, sortKey, sortDir]);

  return (
    <div className="release-page">
      <h1 className="release-title">Kubernetes Version Timeline</h1>
      <p className="release-subtitle">
        Select a Kubernetes release to see which KEPs were introduced or graduated in that version.
      </p>

      <div className="release-controls">
        <label className="release-version-label" htmlFor="release-version-select">
          Release
        </label>
        <select
          id="release-version-select"
          className="release-version-select"
          value={selectedVersion}
          onChange={(e) => setManualVersion(e.target.value)}
        >
          {allVersions
            .slice()
            .reverse()
            .map((v) => (
              <option key={v} value={v}>
                v{v}
              </option>
            ))}
        </select>
        {selectedVersion && !loading && !error && (
          <span className="release-summary">
            {totalKeps} KEP{totalKeps !== 1 ? 's' : ''} with milestone activity in v{selectedVersion}
          </span>
        )}
        <div className="view-toggle">
          <button
            className={`view-toggle-btn${viewMode === 'grid' ? ' view-toggle-btn-active' : ''}`}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            ⊞ Grid
          </button>
          <button
            className={`view-toggle-btn${viewMode === 'table' ? ' view-toggle-btn-active' : ''}`}
            onClick={() => setViewMode('table')}
            aria-label="Table view"
            aria-pressed={viewMode === 'table'}
          >
            ☰ Table
          </button>
        </div>
      </div>

      {loading && <LoadingBar loaded={progress.loaded} total={progress.total} />}

      {error && (
        <div className="error-box">
          <strong>Error loading KEPs:</strong> {error}
          <button className="retry-btn" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && selectedVersion && (
        <>
          {releaseGroups.length === 0 ? (
            <p className="release-empty">
              No KEP milestone activity found for v{selectedVersion}.
            </p>
          ) : (
            sortedGroups.map((group) => (
              <section key={group.label} className="release-group">
                <div className="release-group-header">
                  <h2 className="release-group-title">
                    <span
                      className={`release-stage-badge release-stage-badge--${group.stage}`}
                    >
                      {group.label}
                    </span>
                  </h2>
                  <span className="release-group-count">
                    {group.keps.length} KEP{group.keps.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="release-group-desc">{group.description}</p>
                {viewMode === 'grid' ? (
                  <div className="kep-grid">
                    {group.keps.map((kep) => (
                      <KepCard key={kep.path} kep={kep} />
                    ))}
                  </div>
                ) : (
                  <KepTable keps={group.keps} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                )}
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
