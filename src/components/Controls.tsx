import { useRef } from 'react';
import type { SortDir } from '../utils/kep';
import type { ViewMode } from '../utils/listParams';

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

  function goTo(next: number) {
    onChange(next);
    // The controls sit below the list; start the new page from the top.
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="pagination">
      <button
        className="page-btn"
        onClick={() => goTo(Math.max(1, page - 1))}
        disabled={page === 1}
      >
        ← Previous
      </button>
      <span className="page-info">
        Page {page} of {totalPages}
      </span>
      <button
        className="page-btn"
        onClick={() => goTo(Math.min(totalPages, page + 1))}
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

/**
 * Accessible tab list: ←/→ move to the previous/next tab and Home/End to the
 * first/last, activating it (automatic activation). Only the active tab is in
 * the Tab order. Pair with <TabPanel> using the same `idPrefix`.
 */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  idPrefix,
  label,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (tab: T) => void;
  idPrefix: string;
  label: string;
}) {
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());

  function handleKeyDown(e: React.KeyboardEvent) {
    const index = tabs.findIndex((t) => t.id === active);
    let next: number;
    switch (e.key) {
      case 'ArrowRight': next = (index + 1) % tabs.length; break;
      case 'ArrowLeft': next = (index - 1 + tabs.length) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    e.preventDefault();
    const id = tabs[next].id;
    onChange(id);
    tabRefs.current.get(id)?.focus();
  }

  return (
    <div className="stats-tabs" role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
      {tabs.map(({ id, label: tabLabel }) => (
        <button
          key={id}
          ref={(el) => {
            if (el) tabRefs.current.set(id, el);
            else tabRefs.current.delete(id);
          }}
          id={`${idPrefix}-tab-${id}`}
          className={`stats-tab${active === id ? ' stats-tab--active' : ''}`}
          onClick={() => onChange(id)}
          role="tab"
          aria-selected={active === id}
          aria-controls={`${idPrefix}-panel`}
          tabIndex={active === id ? 0 : -1}
        >
          {tabLabel}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  idPrefix,
  active,
  children,
}: {
  idPrefix: string;
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel`} aria-labelledby={`${idPrefix}-tab-${active}`}>
      {children}
    </div>
  );
}
