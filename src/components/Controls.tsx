import type { SortDir } from '../utils/kep';

export type ViewMode = 'grid' | 'table';

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="view-toggle">
      <button
        className={`view-toggle-btn${value === 'grid' ? ' view-toggle-btn-active' : ''}`}
        onClick={() => onChange('grid')}
        aria-label="Grid view"
        aria-pressed={value === 'grid'}
      >
        ⊞ Grid
      </button>
      <button
        className={`view-toggle-btn${value === 'table' ? ' view-toggle-btn-active' : ''}`}
        onClick={() => onChange('table')}
        aria-label="Table view"
        aria-pressed={value === 'table'}
      >
        ☰ Table
      </button>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button
        className="page-btn"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
      >
        ← Previous
      </button>
      <span className="page-info">
        Page {page} of {totalPages}
      </span>
      <button
        className="page-btn"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
      >
        Next →
      </button>
    </div>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`sort-indicator${active ? ' sort-indicator-active' : ''}`} aria-hidden="true">
      {active ? (dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
    </span>
  );
}

/** A table header cell that sorts by `sortKey` when `onSort` is provided. */
export function SortableTh<K extends string>({
  sortKey,
  label,
  className,
  activeKey,
  dir,
  onSort,
}: {
  sortKey: K;
  label: string;
  className: string;
  activeKey?: K;
  dir: SortDir;
  onSort?: (key: K) => void;
}) {
  if (!onSort) return <th className={`kep-table-th ${className}`}>{label}</th>;
  const isActive = activeKey === sortKey;
  return (
    <th
      className={`kep-table-th kep-table-th-sortable ${className}${isActive ? ' kep-table-th-sorted' : ''}`}
      onClick={() => onSort(sortKey)}
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <SortIndicator active={isActive} dir={dir} />
    </th>
  );
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div className="stats-tabs" role="tablist">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          className={`stats-tab${active === id ? ' stats-tab--active' : ''}`}
          onClick={() => onChange(id)}
          role="tab"
          aria-selected={active === id}
          tabIndex={active === id ? 0 : -1}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
