import { useState, useRef, useEffect, useCallback, useId } from 'react';
import type { KepStatus, KepStage } from '../types/kep';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { NONE_SELECTED, checkedItems, toggleSelection } from '../utils/selection';

export interface Filters {
  query: string;
  sig: string[];
  status: string[];
  stage: string[];
  milestone: string;
  stale: boolean;
  bookmarked: boolean;
}

interface SearchAndFilterProps {
  filters: Filters;
  sigs: string[];
  milestones: string[];
  onChange: (filters: Filters) => void;
  bookmarkCount?: number;
}

export function hasActiveFilters(filters: Filters): boolean {
  return Boolean(
    filters.query ||
    filters.sig.length > 0 ||
    filters.status.length > 0 ||
    filters.stage.length > 0 ||
    filters.milestone ||
    filters.stale ||
    filters.bookmarked,
  );
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

interface CheckboxDropdownProps {
  label: string;
  items: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  renderItem?: (item: string) => string;
}

function formatSigDisplayName(sig: string): string {
  return sig
    .replace(/^sig-/, 'SIG ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CheckboxDropdown({
  label,
  items,
  selected,
  onChange,
  renderItem,
}: CheckboxDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    // Move focus into the panel so keyboard users land on its controls.
    firstActionRef.current?.focus();
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  function handleBlur(e: React.FocusEvent) {
    // Close when keyboard focus moves outside the dropdown (e.g. tabbing past it).
    if (open && e.relatedTarget && !ref.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  const checked = checkedItems(items, selected);

  const isFiltered = selected.length > 0;
  const displayLabel = isFiltered ? `${label} (${checked.length})` : label;

  return (
    <div className="checkbox-dropdown" ref={ref} onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        className={`checkbox-dropdown-btn${isFiltered ? ' checkbox-dropdown-btn--active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        type="button"
      >
        {displayLabel}
        <span className="checkbox-dropdown-arrow" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="checkbox-dropdown-panel" id={panelId} role="group" aria-label={`Filter by ${label}`}>
          <div className="checkbox-dropdown-actions">
            <button
              ref={firstActionRef}
              className="checkbox-dropdown-action-btn"
              onClick={() => onChange([])}
              type="button"
            >
              Select All
            </button>
            <button
              className="checkbox-dropdown-action-btn"
              onClick={() => onChange([NONE_SELECTED])}
              type="button"
            >
              Deselect All
            </button>
          </div>
          <div className="checkbox-dropdown-list">
            {items.map((item) => (
              <label key={item} className="checkbox-dropdown-item">
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={() => onChange(toggleSelection(items, selected, item))}
                />
                <span>{renderItem ? renderItem(item) : item}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SearchAndFilter({
  filters,
  sigs,
  milestones,
  onChange,
  bookmarkCount = 0,
}: SearchAndFilterProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSlash = useCallback((e: KeyboardEvent) => {
    if (e.key === '/') {
      e.preventDefault();
      searchRef.current?.focus();
    }
  }, []);

  useKeyboardShortcut(handleSlash);

  function update(patch: Partial<Filters>) {
    onChange({ ...filters, ...patch });
  }

  const hasFilters = hasActiveFilters(filters);

  return (
    <div className="search-filter-bar">
      <input
        ref={searchRef}
        type="search"
        className="search-input"
        placeholder="Search by title, number, or author…"
        value={filters.query}
        onChange={(e) => update({ query: e.target.value })}
        aria-label="Search KEPs"
      />
      <div className="filter-selects">
        <CheckboxDropdown
          label="SIG"
          items={sigs}
          selected={filters.sig}
          onChange={(sig) => update({ sig })}
          renderItem={formatSigDisplayName}
        />

        <CheckboxDropdown
          label="Status"
          items={STATUSES}
          selected={filters.status}
          onChange={(status) => update({ status })}
          renderItem={(s) => s.charAt(0).toUpperCase() + s.slice(1)}
        />

        <CheckboxDropdown
          label="Stage"
          items={STAGES}
          selected={filters.stage}
          onChange={(stage) => update({ stage })}
          renderItem={(s) => s.charAt(0).toUpperCase() + s.slice(1)}
        />

        {milestones.length > 0 && (
          <select
            className={`milestone-filter-select${filters.milestone ? ' milestone-filter-select--active' : ''}`}
            value={filters.milestone}
            onChange={(e) => update({ milestone: e.target.value })}
            aria-label="Filter by milestone"
          >
            <option value="">Milestone</option>
            {milestones.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}

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
              onChange({ query: '', sig: [], status: [], stage: [], milestone: '', stale: false, bookmarked: false })
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
