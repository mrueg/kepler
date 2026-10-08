'use client';

import { useMemo, useState, useRef, useCallback, useDeferredValue } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { UseProposalsResult } from '../hooks/useProposals';
import { useGepBookmarks } from '../hooks/useBookmarks';
import { useSort } from '../hooks/useSort';
import { useUrlSync } from '../hooks/useUrlSync';
import { gepSearchText } from '../utils/gep';
import { LoadStatus } from '../components/LoadingBar';
import { CheckboxDropdown } from '../components/SearchAndFilter';
import { GepStatusBadge, BookmarkButton } from '../components/Badges';
import { ViewToggle, Pagination, SortableTh } from '../components/Controls';
import { readListDisplayState, writeListDisplayState, type ViewMode } from '../utils/listParams';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import type { Gep } from '../types/gep';
import type { SortDir } from '../utils/kep';

const PAGE_SIZE = 48;

function formatAuthors(authors: string[] | undefined): string {
  if (!authors || authors.length === 0) return '';
  const shown = authors.slice(0, 3).map((a) => `@${a}`).join(', ');
  return authors.length > 3 ? `${shown} +${authors.length - 3}` : shown;
}

function GepCard({
  gep,
  isBookmarked,
  onToggleBookmark,
}: {
  gep: Gep;
  isBookmarked: boolean;
  onToggleBookmark: (gepNumber: string) => void;
}) {
  const gepNumber = String(gep.number);
  return (
    <div className="kep-card">
      <div className="kep-card-number">GEP-{gepNumber}</div>
      <h3 className="kep-card-title">
        <Link href={`/gep?number=${gepNumber}`} className="kep-card-link">
          {gep.name}
        </Link>
      </h3>
      <div className="kep-card-badges">
        <GepStatusBadge status={gep.status} />
      </div>
      {gep.authors && gep.authors.length > 0 && (
        <div className="kep-card-date">{formatAuthors(gep.authors)}</div>
      )}
      <BookmarkButton active={isBookmarked} onToggle={() => onToggleBookmark(gepNumber)} noun="GEP" />
    </div>
  );
}

const GEP_SORT_KEYS = ['number', 'name', 'status'] as const;
type GepSortKey = (typeof GEP_SORT_KEYS)[number];

function GepTable({
  geps,
  isBookmarked,
  onToggleBookmark,
  sortKey,
  sortDir,
  onSort,
}: {
  geps: Gep[];
  isBookmarked: (number: string) => boolean;
  onToggleBookmark: (number: string) => void;
  sortKey?: GepSortKey;
  sortDir: SortDir;
  onSort: (key: GepSortKey) => void;
}) {
  const sortProps = { activeKey: sortKey, dir: sortDir, onSort };

  return (
    <div className="kep-table-wrapper">
      <table className="kep-table">
        <thead>
          <tr>
            <SortableTh sortKey="number" label="Number" className="kep-table-th-number" {...sortProps} />
            <SortableTh sortKey="name" label="Name" className="kep-table-th-title" {...sortProps} />
            <SortableTh sortKey="status" label="Status" className="kep-table-th-status" {...sortProps} />
            <th className="kep-table-th kep-table-th-date">Authors</th>
            <th className="kep-table-th kep-table-th-bookmark" aria-label="Bookmark" />
          </tr>
        </thead>
        <tbody>
          {geps.map((gep) => {
            const gepNumber = String(gep.number);
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
                <td className="kep-table-td kep-table-td-date">{formatAuthors(gep.authors)}</td>
                <td className="kep-table-td kep-table-td-bookmark">
                  <BookmarkButton
                    active={isBookmarked(gepNumber)}
                    onToggle={() => onToggleBookmark(gepNumber)}
                    noun="GEP"
                  />
                </td>
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

export function GepListPage({ data }: { data: UseProposalsResult<Gep> }) {
  const searchParams = useSearchParams();
  const { items: geps, loading, error } = data;
  const { bookmarks, toggleBookmark, isBookmarked } = useGepBookmarks();
  const [filters, setFilters] = useState<GepFilters>({
    query: searchParams.get('q') ?? '',
    status: searchParams.get('status')?.split(',').filter(Boolean) ?? [],
    bookmarked: searchParams.get('bookmarked') === 'true',
  });
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return isNaN(p) || p < 1 ? 1 : p;
  });
  const [initialDisplay] = useState(() => readListDisplayState(searchParams, GEP_SORT_KEYS));
  const [viewMode, setViewMode] = useState<ViewMode>(initialDisplay.viewMode);
  const { sortKey, sortDir, handleSort } = useSort<GepSortKey>(initialDisplay.sortKey, initialDisplay.sortDir);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSlash = useCallback((e: KeyboardEvent) => {
    if (e.key === '/') {
      e.preventDefault();
      searchRef.current?.focus();
    }
  }, []);

  useKeyboardShortcut(handleSlash);

  const urlParams = new URLSearchParams();
  if (filters.query) urlParams.set('q', filters.query);
  if (filters.status.length) urlParams.set('status', filters.status.join(','));
  if (filters.bookmarked) urlParams.set('bookmarked', 'true');
  writeListDisplayState(urlParams, { viewMode, sortKey, sortDir });
  if (page > 1) urlParams.set('page', String(page));
  useUrlSync(urlParams, '/gep');

  const statuses = useMemo(
    () => [...new Set(geps.map((g) => g.status).filter(Boolean))].sort(),
    [geps],
  );

  const searchTexts = useMemo(() => new Map(geps.map((g) => [g.path, gepSearchText(g)])), [geps]);
  const query = useDeferredValue(filters.query);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return geps.filter((gep) => {
      if (q && !searchTexts.get(gep.path)?.includes(q)) return false;
      if (filters.status.length && !filters.status.includes(gep.status ?? '')) return false;
      if (filters.bookmarked && !isBookmarked(String(gep.number))) return false;
      return true;
    });
  }, [geps, searchTexts, query, filters, isBookmarked]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      let av = '';
      let bv = '';
      if (sortKey === 'name') {
        av = (a.name ?? '').toLowerCase();
        bv = (b.name ?? '').toLowerCase();
      } else if (sortKey === 'status') {
        av = a.status ?? '';
        bv = b.status ?? '';
      } else if (sortKey === 'number') {
        return sortDir === 'asc' ? a.number - b.number : b.number - a.number;
      }
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageGeps = sorted.slice(
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
      <div className="search-filter-bar">
        <input
          ref={searchRef}
          className="search-input"
          type="search"
          placeholder="Search GEPs by number, name, or author…"
          value={filters.query}
          onChange={(e) => { setFilters((f) => ({ ...f, query: e.target.value })); setPage(1); }}
          aria-label="Search GEPs"
        />
        <div className="filter-selects">
          <CheckboxDropdown
            label="Status"
            items={statuses}
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

      <LoadStatus {...data} noun="GEPs" />

      {!loading && !error && (
        <div className="results-header">
          <span>
            {filtered.length} GEP{filtered.length !== 1 ? 's' : ''}
            {hasFilters && ` matching filters`}
          </span>
          <ViewToggle value={viewMode} onChange={setViewMode} />
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
        <GepTable geps={pageGeps} isBookmarked={isBookmarked} onToggleBookmark={toggleBookmark} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      )}

      <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
