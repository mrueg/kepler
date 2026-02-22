import type { KepStatus, KepStage } from '../types/kep';

export interface Filters {
  query: string;
  sig: string[];
  status: string[];
  stage: string;
  stale: boolean;
  bookmarked: boolean;
}

interface SearchAndFilterProps {
  filters: Filters;
  sigs: string[];
  onChange: (filters: Filters) => void;
  bookmarkCount?: number;
}

const STATUSES: KepStatus[] = [
  'provisional',
  'implementable',
  'implemented',
  'deferred',
  'rejected',
  'withdrawn',
  'replaced',
];

const STAGES: KepStage[] = ['pre-alpha', 'alpha', 'beta', 'stable'];

export function SearchAndFilter({
  filters,
  sigs,
  onChange,
  bookmarkCount = 0,
}: SearchAndFilterProps) {
  function update(patch: Partial<Filters>) {
    onChange({ ...filters, ...patch });
  }

  const hasFilters =
    filters.query ||
    filters.sig.length > 0 ||
    filters.status.length > 0 ||
    filters.stage ||
    filters.stale ||
    filters.bookmarked;

  return (
    <div className="search-filter-bar">
      <input
        type="search"
        className="search-input"
        placeholder="Search by title, number, author, or README content…"
        value={filters.query}
        onChange={(e) => update({ query: e.target.value })}
        aria-label="Search KEPs"
      />
      <div className="filter-selects">
        <div className="filter-group">
          <label className="filter-label">SIG</label>
          <select
            className="filter-select filter-select--multi"
            multiple
            size={4}
            value={filters.sig}
            onChange={(e) =>
              update({ sig: Array.from(e.target.selectedOptions, (o) => o.value) })
            }
            aria-label="Filter by SIG (hold Ctrl/Cmd to select multiple)"
          >
            {sigs.map((sig) => (
              <option key={sig} value={sig}>
                {sig.replace(/^sig-/, 'SIG ').replace(/-/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Status</label>
          <select
            className="filter-select filter-select--multi"
            multiple
            size={4}
            value={filters.status}
            onChange={(e) =>
              update({ status: Array.from(e.target.selectedOptions, (o) => o.value) })
            }
            aria-label="Filter by status (hold Ctrl/Cmd to select multiple)"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <select
          className="filter-select"
          value={filters.stage}
          onChange={(e) => update({ stage: e.target.value })}
          aria-label="Filter by stage"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        <label className="filter-stale-label">
          <input
            type="checkbox"
            className="filter-stale-checkbox"
            checked={filters.stale}
            onChange={(e) => update({ stale: e.target.checked })}
            aria-label="Show only stale KEPs"
          />
          Stale only
        </label>

        {hasFilters && (
          <button
            className="clear-btn"
            onClick={() =>
              onChange({ query: '', sig: [], status: [], stage: '', stale: false, bookmarked: false })
            }
          >
            Clear
          </button>
        )}
        {(bookmarkCount > 0 || filters.bookmarked) && (
          <button
            className={`bookmark-filter-btn${filters.bookmarked ? ' bookmark-filter-btn-active' : ''}`}
            onClick={() => update({ bookmarked: !filters.bookmarked })}
            aria-pressed={filters.bookmarked}
            title={filters.bookmarked ? 'Show all KEPs' : 'Show bookmarked KEPs only'}
          >
            {filters.bookmarked ? '★' : '☆'} Bookmarks
            {bookmarkCount > 0 && (
              <span className="bookmark-filter-count">{bookmarkCount}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
