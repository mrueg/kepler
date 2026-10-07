'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { UseProposalsResult } from '../hooks/useProposals';
import { useGepBookmarks } from '../hooks/useBookmarks';
import { useSort } from '../hooks/useSort';
import { LoadStatus } from '../components/LoadingBar';
import { CheckboxDropdown } from '../components/SearchAndFilter';
import { GepStatusBadge, BookmarkButton } from '../components/Badges';
import { ViewToggle, Pagination, SortableTh, type ViewMode } from '../components/Controls';
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
    <Link href={`/gep?number=${gepNumber}`} className="kep-card">
      <div className="kep-card-number">GEP-{gepNumber}</div>
      <h3 className="kep-card-title">{gep.name}</h3>
      <div className="kep-card-badges">
        <GepStatusBadge status={gep.status} />
      </div>
      {gep.authors && gep.authors.length > 0 && (
        <div className="kep-card-date">{formatAuthors(gep.authors)}</div>
      )}
      <BookmarkButton active={isBookmarked} onToggle={() => onToggleBookmark(gepNumber)} noun="GEP" />
    </Link>
  );
}

type GepSortKey = 'number' | 'name' | 'status';

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
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const { items: geps, loading, error } = data;
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
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { sortKey, sortDir, handleSort } = useSort<GepSortKey>();
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSlash = useCallback((e: KeyboardEvent) => {
    if (e.key === '/') {
      e.preventDefault();
      searchRef.current?.focus();
    }
  }, []);

  useKeyboardShortcut(handleSlash);

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
