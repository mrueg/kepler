'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useGeps } from '../hooks/useGeps';
import { useGepBookmarks } from '../hooks/useGepBookmarks';
import { useRecentGepChanges } from '../hooks/useRecentGepChanges';
import { LoadingBar } from '../components/LoadingBar';
import { CheckboxDropdown } from '../components/SearchAndFilter';
import { WhatsNew } from '../components/WhatsNew';
import type { Gep, GepStatus } from '../types/gep';
import { GEP_STATUS_COLORS } from '../utils/gep';

const PAGE_SIZE = 48;

function GepStatusBadge({ status }: { status?: GepStatus }) {
  if (!status) return null;
  const color = GEP_STATUS_COLORS[status] ?? '#8b949e';
  return (
    <span className="gep-status-badge" style={{ '--gep-badge-color': color } as React.CSSProperties}>
      {status}
    </span>
  );
}

function GepCard({
  gep,
  isBookmarked,
  onToggleBookmark,
}: {
  gep: Gep;
  isBookmarked?: boolean;
  onToggleBookmark?: (gepNumber: string) => void;
}) {
  const gepNumber = String(gep.number);
  return (
    <Link href={`/gep?number=${gepNumber}`} className="kep-card">
      <div className="kep-card-number">GEP-{gepNumber}</div>
      <div className="kep-card-title">{gep.name}</div>
      <div className="kep-card-badges">
        <GepStatusBadge status={gep.status} />
      </div>
      {gep.authors && gep.authors.length > 0 && (
        <div className="kep-card-date">
          {gep.authors.slice(0, 3).map((a) => `@${a}`).join(', ')}
          {gep.authors.length > 3 ? ` +${gep.authors.length - 3}` : ''}
        </div>
      )}
      {onToggleBookmark && (
        <button
          className={`bookmark-star${isBookmarked ? ' bookmark-star-active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleBookmark(gepNumber);
          }}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
          aria-pressed={isBookmarked}
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark this GEP'}
        >
          {isBookmarked ? '★' : '☆'}
        </button>
      )}
    </Link>
  );
}

function GepTable({
  geps,
  isBookmarked,
  onToggleBookmark,
}: {
  geps: Gep[];
  isBookmarked?: (number: string) => boolean;
  onToggleBookmark?: (number: string) => void;
}) {
  return (
    <div className="kep-table-wrapper">
      <table className="kep-table">
        <thead>
          <tr>
            <th className="kep-table-th kep-table-th-number">Number</th>
            <th className="kep-table-th kep-table-th-title">Name</th>
            <th className="kep-table-th kep-table-th-status">Status</th>
            <th className="kep-table-th kep-table-th-date">Authors</th>
            {onToggleBookmark && (
              <th className="kep-table-th kep-table-th-bookmark" aria-label="Bookmark" />
            )}
          </tr>
        </thead>
        <tbody>
          {geps.map((gep) => {
            const gepNumber = String(gep.number);
            const bookmarked = isBookmarked?.(gepNumber) ?? false;
            return (
              <tr key={gep.path} className="kep-table-row">
                <td className="kep-table-td kep-table-td-number">
                  <Link href={`/gep?number=${gepNumber}`} className="kep-table-number-link">
                    GEP-{gepNumber}
                  </Link>
                </td>
                <td className="kep-table-td kep-table-td-title">
                  <Link href={`/gep?number=${gepNumber}`} className="kep-table-title-link">
                    {gep.name}
                  </Link>
                </td>
                <td className="kep-table-td kep-table-td-status">
                  <GepStatusBadge status={gep.status} />
                </td>
                <td className="kep-table-td kep-table-td-date">
                  {gep.authors?.slice(0, 3).map((a) => `@${a}`).join(', ')}
                  {(gep.authors?.length ?? 0) > 3 ? ` +${gep.authors!.length - 3}` : ''}
                </td>
                {onToggleBookmark && (
                  <td className="kep-table-td kep-table-td-bookmark">
                    <button
                      className={`bookmark-star${bookmarked ? ' bookmark-star-active' : ''}`}
                      onClick={() => onToggleBookmark(gepNumber)}
                      aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                      aria-pressed={bookmarked}
                      title={bookmarked ? 'Remove bookmark' : 'Bookmark this GEP'}
                    >
                      {bookmarked ? '★' : '☆'}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface GepFilters {
  query: string;
  status: string[];
  bookmarked: boolean;
}

export function GepListPage() {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const { geps, loading, progress, error, reload } = useGeps();
  const { changes: recentGepChanges, loading: gitLoading } = useRecentGepChanges();
  const { bookmarks, toggleBookmark, isBookmarked } = useGepBookmarks();
  const [filters, setFilters] = useState<GepFilters>({
    query: searchParams.get('q') ?? '',
    status: searchParams.get('status')?.split(',').filter(Boolean) ?? [],
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
    if (filters.status.length) params.set('status', filters.status.join(','));
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    const newSearch = qs ? `?${qs}` : '';
    if (typeof window !== 'undefined' && newSearch !== window.location.search) {
      replace(newSearch || '/gep', { scroll: false });
    }
  }, [filters, page, replace]);

  const statuses = useMemo(
    () => [...new Set(geps.map((g) => g.status).filter(Boolean))].sort(),
    [geps],
  );

  const filtered = useMemo(() => {
    const q = filters.query.toLowerCase();
    return geps.filter((gep) => {
      if (
        q &&
        !gep.name?.toLowerCase().includes(q) &&
        !String(gep.number).includes(q) &&
        !gep.authors?.some((a) => a.toLowerCase().includes(q)) &&
        !gep.content?.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (filters.status.length && !filters.status.includes(gep.status ?? '')) return false;
      if (filters.bookmarked && !isBookmarked(String(gep.number))) return false;
      return true;
    });
  }, [geps, filters, isBookmarked]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageGeps = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const hasFilters = filters.query || filters.status.length > 0 || filters.bookmarked;

  function handleClear() {
    setFilters({ query: '', status: [], bookmarked: false });
    setPage(1);
  }

  return (
    <div className="list-page">
      <div className="list-page-layout">
        <div className="list-page-main">
          <div className="search-filter-bar">
            <input
              className="search-input"
              type="search"
              placeholder="Search GEPs by number, name, or author…"
              value={filters.query}
              onChange={(e) => { setFilters((f) => ({ ...f, query: e.target.value })); setPage(1); }}
            />
            <div className="filter-selects">
              <CheckboxDropdown
                label="Status"
                items={statuses as string[]}
                selected={filters.status}
                onChange={(status) => { setFilters((f) => ({ ...f, status })); setPage(1); }}
              />
              {hasFilters && (
                <button className="clear-btn" onClick={handleClear}>
                  Clear
                </button>
              )}
              {(bookmarks.size > 0 || filters.bookmarked) && (
                <button
                  className={`bookmark-filter-btn${filters.bookmarked ? ' bookmark-filter-btn-active' : ''}`}
                  onClick={() => { setFilters((f) => ({ ...f, bookmarked: !f.bookmarked })); setPage(1); }}
                  aria-pressed={filters.bookmarked}
                  title={filters.bookmarked ? 'Show all GEPs' : 'Show bookmarked GEPs only'}
                >
                  {filters.bookmarked ? '★' : '☆'} Bookmarks
                  {bookmarks.size > 0 && (
                    <span className="bookmark-filter-count">{bookmarks.size}</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {loading && <LoadingBar loaded={progress.loaded} total={progress.total} />}

          {error && (
            <div className="error-box">
              <strong>Error loading GEPs:</strong> {error}
              <button className="retry-btn" onClick={reload}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="results-header">
              <span>
                {filtered.length} GEP{filtered.length !== 1 ? 's' : ''}
                {hasFilters && ` matching filters`}
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
              {pageGeps.map((gep) => (
                <GepCard
                  key={gep.path}
                  gep={gep}
                  isBookmarked={isBookmarked(String(gep.number))}
                  onToggleBookmark={toggleBookmark}
                />
              ))}
            </div>
          ) : (
            <GepTable geps={pageGeps} isBookmarked={isBookmarked} onToggleBookmark={toggleBookmark} />
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

        <WhatsNew geps={geps} recentGepChanges={recentGepChanges} loading={loading || gitLoading} />
      </div>
    </div>
  );
}
