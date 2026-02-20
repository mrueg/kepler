import type { KepStatus, KepStage } from '../types/kep';

export interface Filters {
  query: string;
  sig: string;
  status: string;
  stage: string;
  stale: boolean;
}

interface SearchAndFilterProps {
  filters: Filters;
  sigs: string[];
  onChange: (filters: Filters) => void;
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
}: SearchAndFilterProps) {
  function update(patch: Partial<Filters>) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div className="search-filter-bar">
      <input
        type="search"
        className="search-input"
        placeholder="Search by title, KEP number, or author…"
        value={filters.query}
        onChange={(e) => update({ query: e.target.value })}
        aria-label="Search KEPs"
      />
      <div className="filter-selects">
        <select
          className="filter-select"
          value={filters.sig}
          onChange={(e) => update({ sig: e.target.value })}
          aria-label="Filter by SIG"
        >
          <option value="">All SIGs</option>
          {sigs.map((sig) => (
            <option key={sig} value={sig}>
              {sig.replace(/^sig-/, 'SIG ').replace(/-/g, ' ')}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filters.status}
          onChange={(e) => update({ status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

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

        {(filters.query || filters.sig || filters.status || filters.stage || filters.stale) && (
          <button
            className="clear-btn"
            onClick={() =>
              onChange({ query: '', sig: '', status: '', stage: '', stale: false })
            }
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
