'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useKeps } from '../hooks/useKeps';
import { useBookmarks } from '../hooks/useBookmarks';
import { KepCard } from '../components/KepCard';
import { KepTable } from '../components/KepTable';
import { LoadingBar } from '../components/LoadingBar';
import { SearchAndFilter, type Filters } from '../components/SearchAndFilter';
import { isStale } from '../utils/kep';

const PAGE_SIZE = 48;

export function KepListPage() {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const { keps, loading, progress, error, reload } = useKeps();
  const { bookmarks, toggleBookmark, isBookmarked } = useBookmarks();
  const [filters, setFilters] = useState<Filters>({
    query: searchParams.get('q') ?? '',
    sig: searchParams.get('sig') ?? '',
    status: searchParams.get('status') ?? '',
    stage: searchParams.get('stage') ?? '',
    stale: searchParams.get('stale') === 'true',
    bookmarked: false,
  });
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return isNaN(p) || p < 1 ? 1 : p;
  });
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (filters.sig) params.set('sig', filters.sig);
    if (filters.status) params.set('status', filters.status);
    if (filters.stage) params.set('stage', filters.stage);
    if (filters.stale) params.set('stale', 'true');
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    replace(qs ? `?${qs}` : '/', { scroll: false });
  }, [filters, page, replace]);

  const sigs = useMemo(
    () => [...new Set(keps.map((k) => k.sig))].sort(),
    [keps],
  );

  const filtered = useMemo(() => {
    const q = filters.query.toLowerCase();
    return keps.filter((kep) => {
      if (
        q &&
        !kep.title?.toLowerCase().includes(q) &&
        !kep.number.includes(q) &&
        !kep.authors?.some((a) => a.toLowerCase().includes(q)) &&
        !kep.slug.includes(q)
      ) {
        return false;
      }
      if (filters.sig && kep.sig !== filters.sig) return false;
      if (filters.status && kep.status !== filters.status) return false;
      if (filters.stage && kep.stage !== filters.stage) return false;
      if (filters.stale && !isStale(kep)) return false;
      if (filters.bookmarked && !isBookmarked(kep.number)) return false;
      return true;
    });
  }, [keps, filters, isBookmarked]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageKeps = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function handleFilterChange(f: Filters) {
    setFilters(f);
    setPage(1);
  }

  return (
    <div className="list-page">
      <SearchAndFilter filters={filters} sigs={sigs} onChange={handleFilterChange} bookmarkCount={bookmarks.size} />

      {loading && <LoadingBar loaded={progress.loaded} total={progress.total} />}

      {error && (
        <div className="error-box">
          <strong>Error loading KEPs:</strong> {error}
          <button className="retry-btn" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="results-header">
          <span>
            {filtered.length} KEP{filtered.length !== 1 ? 's' : ''}
            {(filters.query || filters.sig || filters.status || filters.stage || filters.stale || filters.bookmarked) &&
              ` matching filters`}
          </span>
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
        <KepTable keps={pageKeps} isBookmarked={isBookmarked} onToggleBookmark={toggleBookmark} />
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ← Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
