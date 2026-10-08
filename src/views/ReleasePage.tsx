'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UseProposalsResult } from '../hooks/useProposals';
import { useSort } from '../hooks/useSort';
import { LoadStatus } from '../components/LoadingBar';
import { KepCard } from '../components/KepCard';
import { KepTable } from '../components/KepTable';
import { ViewToggle } from '../components/Controls';
import { readListDisplayState, writeListDisplayState, type ViewMode } from '../utils/listParams';
import { sortKeps, normalizeVersion, compareVersions, KEP_SORT_KEYS, type KepSortKey } from '../utils/kep';
import type { Kep } from '../types/kep';

interface ReleaseGroup {
  label: string;
  description: string;
  keps: Kep[];
  stage: 'alpha' | 'beta' | 'stable';
}

export function ReleasePage({ data }: { data: UseProposalsResult<Kep> }) {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  // Keep a ref so the URL-sync effect can read the latest searchParams without
  // listing it as a dependency (which would cause it to re-run on every
  // navigation and create an infinite replace loop).
  const searchParamsRef = useRef(searchParams);
  // Update the ref after every render (effects run in order, so this runs
  // before the URL-sync effect below when both fire in the same commit).
  useEffect(() => {
    searchParamsRef.current = searchParams;
  });
  const { items: keps, loading, error } = data;

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
    return Array.from(versions).sort(compareVersions);
  }, [keps]);

  const [manualVersion, setManualVersion] = useState<string>(
    searchParams.get('v') ?? '',
  );
  const [initialDisplay] = useState(() => readListDisplayState(searchParams, KEP_SORT_KEYS));
  const [viewMode, setViewMode] = useState<ViewMode>(initialDisplay.viewMode);
  const { sortKey, sortDir, handleSort } = useSort<KepSortKey>(initialDisplay.sortKey, initialDisplay.sortDir);

  // Derive the effective version: use manual selection if set, otherwise default to latest
  const selectedVersion =
    manualVersion || (allVersions.length > 0 ? allVersions[allVersions.length - 1] : '');

  useEffect(() => {
    if (selectedVersion) {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      params.set('tab', 'release');
      params.set('v', selectedVersion);
      writeListDisplayState(params, { viewMode, sortKey, sortDir });
      const newSearch = `?${params.toString()}`;
      if (typeof window !== 'undefined' && newSearch !== window.location.search) {
        replace(newSearch, { scroll: false });
      }
    }
  }, [selectedVersion, viewMode, sortKey, sortDir, replace]);

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

  const sortedGroups = useMemo(
    () => releaseGroups.map((group) => ({ ...group, keps: sortKeps(group.keps, sortKey, sortDir) })),
    [releaseGroups, sortKey, sortDir],
  );

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
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      <LoadStatus {...data} noun="KEPs" />

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
