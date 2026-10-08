'use client';

import { useMemo, useState, useDeferredValue } from 'react';
import { useSearchParams } from 'next/navigation';
import type { UseProposalsResult } from '../hooks/useProposals';
import { useKepBookmarks } from '../hooks/useBookmarks';
import { useSort } from '../hooks/useSort';
import { useUrlSync } from '../hooks/useUrlSync';
import { KepCard } from '../components/KepCard';
import { KepTable } from '../components/KepTable';
import { LoadStatus } from '../components/LoadingBar';
import { ViewToggle, Pagination } from '../components/Controls';
import { readListDisplayState, writeListDisplayState, type ViewMode } from '../utils/listParams';
import { SearchAndFilter, hasActiveFilters, type Filters } from '../components/SearchAndFilter';
import { isStale, sortKeps, compareVersions, kepSearchText, KEP_SORT_KEYS, type KepSortKey } from '../utils/kep';
import type { Kep } from '../types/kep';

const PAGE_SIZE = 48;

export function KepListPage({ data }: { data: UseProposalsResult<Kep> }) {
  const searchParams = useSearchParams();
  const { items: keps, loading, error } = data;
  const { bookmarks, toggleBookmark, isBookmarked } = useKepBookmarks();
  const [filters, setFilters] = useState<Filters>({
    query: searchParams.get('q') ?? '',
    sig: searchParams.get('sig')?.split(',').filter(Boolean) ?? [],
    status: searchParams.get('status')?.split(',').filter(Boolean) ?? [],
    stage: searchParams.get('stage')?.split(',').filter(Boolean) ?? [],
    milestone: searchParams.get('milestone') ?? '',
    stale: searchParams.get('stale') === 'true',
    bookmarked: searchParams.get('bookmarked') === 'true',
  });
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return isNaN(p) || p < 1 ? 1 : p;
  });
  const [initialDisplay] = useState(() => readListDisplayState(searchParams, KEP_SORT_KEYS));
  const [viewMode, setViewMode] = useState<ViewMode>(initialDisplay.viewMode);
  const { sortKey, sortDir, handleSort } = useSort<KepSortKey>(initialDisplay.sortKey, initialDisplay.sortDir);

  const urlParams = new URLSearchParams();
  if (filters.query) urlParams.set('q', filters.query);
  if (filters.sig.length) urlParams.set('sig', filters.sig.join(','));
  if (filters.status.length) urlParams.set('status', filters.status.join(','));
  if (filters.stage.length) urlParams.set('stage', filters.stage.join(','));
  if (filters.milestone) urlParams.set('milestone', filters.milestone);
  if (filters.stale) urlParams.set('stale', 'true');
  if (filters.bookmarked) urlParams.set('bookmarked', 'true');
  writeListDisplayState(urlParams, { viewMode, sortKey, sortDir });
  if (page > 1) urlParams.set('page', String(page));
  useUrlSync(urlParams, '/');

  const sigs = useMemo(
    () => [...new Set(keps.map((k) => k.sig))].sort(),
    [keps],
  );

  const milestones = useMemo(() => {
    const ms = keps
      .map((k) => k['latest-milestone'])
      .filter((m): m is string => Boolean(m));
    // Newest first
    return [...new Set(ms)].sort((a, b) => compareVersions(b, a));
  }, [keps]);

  const searchTexts = useMemo(() => new Map(keps.map((k) => [k.path, kepSearchText(k)])), [keps]);
  // Filtering ~700 KEPs can lag behind fast typing; let the input stay responsive.
  const query = useDeferredValue(filters.query);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return keps.filter((kep) => {
      if (q && !searchTexts.get(kep.path)?.includes(q)) return false;
      if (filters.sig.length && !filters.sig.includes(kep.sig)) return false;
      if (filters.status.length && !filters.status.includes(kep.status ?? '')) return false;
      if (filters.stage.length && !filters.stage.includes(kep.stage ?? '')) return false;
      if (filters.milestone && kep['latest-milestone'] !== filters.milestone) return false;
      if (filters.stale && !isStale(kep)) return false;
      if (filters.bookmarked && !isBookmarked(kep.number)) return false;
      return true;
    });
  }, [keps, searchTexts, query, filters, isBookmarked]);

  const sorted = useMemo(() => sortKeps(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageKeps = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function handleFilterChange(f: Filters) {
    setFilters(f);
    setPage(1);
  }

  return (
    <div className="list-page">
      <SearchAndFilter filters={filters} sigs={sigs} milestones={milestones} onChange={handleFilterChange} bookmarkCount={bookmarks.size} />

      <LoadStatus {...data} noun="KEPs" />

      {!loading && !error && (
        <div className="results-header">
          <span>
            {filtered.length} KEP{filtered.length !== 1 ? 's' : ''}
            {hasActiveFilters(filters) && ` matching filters`}
          </span>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="kep-grid">
          {pageKeps.map((kep) => (
            <KepCard
              key={kep.path}
              kep={kep}
              isBookmarked={isBookmarked(kep.number)}
              onToggleBookmark={toggleBookmark}
            />
          ))}
        </div>
      ) : (
        <KepTable keps={pageKeps} isBookmarked={isBookmarked} onToggleBookmark={toggleBookmark} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      )}

      <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
