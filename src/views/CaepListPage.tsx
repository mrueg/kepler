'use client';

import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { UseProposalsResult } from '../hooks/useProposals';
import { useCaepBookmarks } from '../hooks/useBookmarks';
import { useSort } from '../hooks/useSort';
import { useUrlSync } from '../hooks/useUrlSync';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { LoadStatus } from '../components/LoadingBar';
import { CheckboxDropdown } from '../components/SearchAndFilter';
import { ArchivedBadge, BookmarkButton, CaepStatusBadge } from '../components/Badges';
import { Pagination, SortableTh, ViewToggle } from '../components/Controls';
import { readListDisplayState, writeListDisplayState, type ViewMode } from '../utils/listParams';
import type { SortDir } from '../utils/kep';
import { caepHref, caepSearchText } from '../api/clusterapi';
import type { Caep } from '../types/caep';

const PAGE_SIZE = 48;
const CAEP_SORT_KEYS = ['date', 'title', 'status'] as const;
type CaepSortKey = (typeof CAEP_SORT_KEYS)[number];

function formatAuthors(authors: string[] | undefined): string {
  if (!authors || authors.length === 0) return '';
  const shown = authors.slice(0, 3).join(', ');
  return authors.length > 3 ? `${shown} +${authors.length - 3}` : shown;
}

function CaepCard({ caep, isBookmarked, onToggleBookmark }: {
  caep: Caep;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
}) {
  return (
    <div className="kep-card">
      <div className="kep-card-number">CAEP · {caep.date}</div>
      <h3 className="kep-card-title">
        <Link href={caepHref(caep.id)} className="kep-card-link">
          {caep.title}
        </Link>
      </h3>
      <div className="kep-card-badges">
        <CaepStatusBadge status={caep.status} />
        {caep.archived && <ArchivedBadge />}
      </div>
      {caep.authors && <div className="kep-card-date">{formatAuthors(caep.authors)}</div>}
      <BookmarkButton active={isBookmarked} onToggle={() => onToggleBookmark(caep.id)} noun="CAEP" />
    </div>
  );
}

function CaepTable({ caeps, isBookmarked, onToggleBookmark, sortKey, sortDir, onSort }: {
  caeps: Caep[];
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
  sortKey?: CaepSortKey;
  sortDir: SortDir;
  onSort: (key: CaepSortKey) => void;
}) {
  const sortProps = { activeKey: sortKey, dir: sortDir, onSort };
  return (
    <div className="kep-table-wrapper">
      <table className="kep-table">
        <thead>
          <tr>
            <SortableTh sortKey="date" label="Date" className="kep-table-th-date" {...sortProps} />
            <SortableTh sortKey="title" label="Title" className="kep-table-th-title" {...sortProps} />
            <SortableTh sortKey="status" label="Status" className="kep-table-th-status" {...sortProps} />
            <th className="kep-table-th">Authors</th>
            <th className="kep-table-th kep-table-th-bookmark" aria-label="Bookmark" />
          </tr>
        </thead>
        <tbody>
          {caeps.map((caep) => (
            <tr key={caep.path} className="kep-table-row">
              <td className="kep-table-td kep-table-td-date">{caep.date}</td>
              <td className="kep-table-td kep-table-td-title">
                <Link href={caepHref(caep.id)} className="kep-table-title-link">
                  {caep.title}
                </Link>
              </td>
              <td className="kep-table-td kep-table-td-status">
                <CaepStatusBadge status={caep.status} />
                {caep.archived && <ArchivedBadge />}
              </td>
              <td className="kep-table-td">{formatAuthors(caep.authors)}</td>
              <td className="kep-table-td kep-table-td-bookmark">
                <BookmarkButton active={isBookmarked(caep.id)} onToggle={() => onToggleBookmark(caep.id)} noun="CAEP" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sortCaeps(caeps: Caep[], key: CaepSortKey | undefined, dir: SortDir): Caep[] {
  if (!key) return caeps;
  const value = (c: Caep) => (key === 'date' ? c.date : key === 'title' ? c.title.toLowerCase() : c.status ?? '');
  return [...caeps].sort((a, b) => {
    const cmp = value(a).localeCompare(value(b));
    return dir === 'asc' ? cmp : -cmp;
  });
}

interface CaepFilters {
  query: string;
  status: string[];
  bookmarked: boolean;
}

/** Cluster API Enhancement Proposals from kubernetes-sigs/cluster-api/docs/proposals. */
export function CaepListPage({ data }: { data: UseProposalsResult<Caep> }) {
  const searchParams = useSearchParams();
  const { items: caeps, loading, error } = data;
  const { bookmarks, toggleBookmark, isBookmarked } = useCaepBookmarks();
  const [filters, setFilters] = useState<CaepFilters>({
    query: searchParams.get('q') ?? '',
    status: searchParams.get('status')?.split(',').filter(Boolean) ?? [],
    bookmarked: searchParams.get('bookmarked') === 'true',
  });
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return isNaN(p) || p < 1 ? 1 : p;
  });
  const [initialDisplay] = useState(() => readListDisplayState(searchParams, CAEP_SORT_KEYS));
  const [viewMode, setViewMode] = useState<ViewMode>(initialDisplay.viewMode);
  const { sortKey, sortDir, handleSort } = useSort<CaepSortKey>(initialDisplay.sortKey, initialDisplay.sortDir);
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
  useUrlSync(urlParams, '/caep');

  // "unknown" stands for proposals without a status in their front matter.
  const statuses = useMemo(() => [...new Set(caeps.map((c) => c.status ?? 'unknown'))].sort(), [caeps]);
  const searchTexts = useMemo(() => new Map(caeps.map((c) => [c.path, caepSearchText(c)])), [caeps]);
  const query = useDeferredValue(filters.query);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return caeps.filter((caep) => {
      if (q && !searchTexts.get(caep.path)?.includes(q)) return false;
      if (filters.status.length && !filters.status.includes(caep.status ?? 'unknown')) return false;
      if (filters.bookmarked && !isBookmarked(caep.id)) return false;
      return true;
    });
  }, [caeps, searchTexts, query, filters, isBookmarked]);

  const sorted = useMemo(() => sortCaeps(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageCaeps = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = filters.query || filters.status.length > 0 || filters.bookmarked;

  function updateFilters(patch: Partial<CaepFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  return (
    <div className="list-page">
      <div className="search-filter-bar">
        <input
          ref={searchRef}
          className="search-input"
          type="search"
          placeholder="Search CAEPs by title, author, or content…"
          value={filters.query}
          onChange={(e) => updateFilters({ query: e.target.value })}
          aria-label="Search CAEPs"
        />
        <div className="filter-selects">
          <CheckboxDropdown
            label="Status"
            items={statuses}
            selected={filters.status}
            onChange={(status) => updateFilters({ status })}
            renderItem={(s) => s.charAt(0).toUpperCase() + s.slice(1)}
          />
          {hasFilters && (
            <button className="clear-btn" onClick={() => updateFilters({ query: '', status: [], bookmarked: false })}>
              Clear
            </button>
          )}
          {(bookmarks.size > 0 || filters.bookmarked) && (
            <button
              className={`bookmark-filter-btn${filters.bookmarked ? ' bookmark-filter-btn-active' : ''}`}
              onClick={() => updateFilters({ bookmarked: !filters.bookmarked })}
              aria-pressed={filters.bookmarked}
              title={filters.bookmarked ? 'Show all CAEPs' : 'Show bookmarked CAEPs only'}
            >
              {filters.bookmarked ? '★' : '☆'} Bookmarks
              {bookmarks.size > 0 && <span className="bookmark-filter-count">{bookmarks.size}</span>}
            </button>
          )}
        </div>
      </div>

      <LoadStatus {...data} noun="CAEPs" />

      {!loading && !error && (
        <div className="results-header">
          <span>
            {filtered.length} CAEP{filtered.length !== 1 ? 's' : ''}
            {hasFilters && ' matching filters'}
          </span>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="kep-grid">
          {pageCaeps.map((caep) => (
            <CaepCard key={caep.path} caep={caep} isBookmarked={isBookmarked(caep.id)} onToggleBookmark={toggleBookmark} />
          ))}
        </div>
      ) : (
        <CaepTable caeps={pageCaeps} isBookmarked={isBookmarked} onToggleBookmark={toggleBookmark} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      )}

      <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
