'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useGeps } from '../hooks/useGeps';
import { LoadingBar } from '../components/LoadingBar';
import type { Gep, GepStatus } from '../types/gep';

const PAGE_SIZE = 48;

const GEP_STATUS_COLORS: Record<GepStatus, string> = {
  Memorandum: '#6e40c9',
  Provisional: '#e2a03f',
  Experimental: '#326ce5',
  Standard: '#2ea043',
  Declined: '#cf222e',
  Deferred: '#8b949e',
  Withdrawn: '#9a6700',
};

function GepStatusBadge({ status }: { status?: GepStatus }) {
  if (!status) return null;
  const color = GEP_STATUS_COLORS[status] ?? '#8b949e';
  return (
    <span className="gep-status-badge" style={{ '--gep-badge-color': color } as React.CSSProperties}>
      {status}
    </span>
  );
}

function GepCard({ gep }: { gep: Gep }) {
  return (
    <Link href={`/gep?number=${gep.number}`} className="kep-card">
      <div className="kep-card-number">GEP-{gep.number}</div>
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
    </Link>
  );
}

interface GepFilters {
  query: string;
  status: string;
}

export function GepListPage() {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const { geps, loading, progress, error, reload } = useGeps();
  const [filters, setFilters] = useState<GepFilters>({
    query: searchParams.get('q') ?? '',
    status: searchParams.get('status') ?? '',
  });
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return isNaN(p) || p < 1 ? 1 : p;
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (filters.status) params.set('status', filters.status);
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
        !gep.authors?.some((a) => a.toLowerCase().includes(q))
      ) {
        return false;
      }
      if (filters.status && gep.status !== filters.status) return false;
      return true;
    });
  }, [geps, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageGeps = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function handleQueryChange(q: string) {
    setFilters((f) => ({ ...f, query: q }));
    setPage(1);
  }

  function handleStatusChange(status: string) {
    setFilters((f) => ({ ...f, status }));
    setPage(1);
  }

  function handleClear() {
    setFilters({ query: '', status: '' });
    setPage(1);
  }

  const hasFilters = filters.query || filters.status;

  return (
    <div className="list-page">
      <div className="search-filter-bar">
        <input
          className="search-input"
          type="search"
          placeholder="Search GEPs by number, name, or author…"
          value={filters.query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />
        <div className="filter-selects">
          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {hasFilters && (
            <button className="clear-btn" onClick={handleClear}>
              Clear
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
        </div>
      )}

      <div className="kep-grid">
        {pageGeps.map((gep) => (
          <GepCard key={gep.path} gep={gep} />
        ))}
      </div>

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
