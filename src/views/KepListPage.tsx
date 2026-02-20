'use client';

import { useMemo, useState } from 'react';
import { useKeps } from '../hooks/useKeps';
import { KepCard } from '../components/KepCard';
import { LoadingBar } from '../components/LoadingBar';
import { SearchAndFilter, type Filters } from '../components/SearchAndFilter';

const PAGE_SIZE = 48;

export function KepListPage() {
  const { keps, loading, progress, error, reload } = useKeps();
  const [filters, setFilters] = useState<Filters>({
    query: '',
    sig: '',
    status: '',
    stage: '',
  });
  const [page, setPage] = useState(1);

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
      return true;
    });
  }, [keps, filters]);

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
      <SearchAndFilter filters={filters} sigs={sigs} onChange={handleFilterChange} />

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
          {filtered.length} KEP{filtered.length !== 1 ? 's' : ''}
          {(filters.query || filters.sig || filters.status || filters.stage) &&
            ` matching filters`}
        </div>
      )}

      <div className="kep-grid">
        {pageKeps.map((kep) => (
          <KepCard key={kep.path} kep={kep} />
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
