import { useState, useRef, useEffect, useCallback } from 'react';
import type { KepStatus, KepStage } from '../types/kep';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';

export interface Filters {
  query: string;
  sig: string[];
  status: string[];
  stage: string[];
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
  const [allUnchecked, setAllUnchecked] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleToggleOpen() {
    // When opening with no active filter, reset to "all checked" visual state
    if (!open && selected.length === 0) setAllUnchecked(false);
    setOpen((o) => !o);
  }

  function isChecked(item: string): boolean {
    if (allUnchecked) return false;
    if (selected.length === 0) return true;
    return selected.includes(item);
  }

  function toggle(item: string) {
    let currentlyChecked: string[];
    if (allUnchecked) {
      currentlyChecked = [];
    } else if (selected.length === 0) {
      currentlyChecked = items;
    } else {
      currentlyChecked = selected;
    }
    let next: string[];
    if (currentlyChecked.includes(item)) {
      next = currentlyChecked.filter((i) => i !== item);
    } else {
      next = [...currentlyChecked, item];
    }
    setAllUnchecked(false);
    onChange(next.length === items.length ? [] : next);
  }

  function selectAll() {
    setAllUnchecked(false);
    onChange([]);
  }

  function deselectAll() {
    setAllUnchecked(true);
    onChange([]);
  }

  const isFiltered = selected.length > 0;
  const displayLabel = isFiltered ? `${label} (${selected.length})` : label;

  return (
    <div className="checkbox-dropdown" ref={ref}>
      <button
        className={`checkbox-dropdown-btn${isFiltered ? ' checkbox-dropdown-btn--active' : ''}`}
        onClick={() => handleToggleOpen()}
        aria-expanded={open}
        aria-haspopup="listbox"
        type="button"
      >
        {displayLabel}
        <span className="checkbox-dropdown-arrow" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="checkbox-dropdown-panel" role="listbox" aria-multiselectable="true">
          <div className="checkbox-dropdown-actions">
            <button
              className="checkbox-dropdown-action-btn"
              onClick={selectAll}
              type="button"
            >
              Select All
            </button>
            <button
              className="checkbox-dropdown-action-btn"
              onClick={deselectAll}
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
                  checked={isChecked(item)}
                  onChange={() => toggle(item)}
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

  const hasFilters =
    filters.query ||
    filters.sig.length > 0 ||
    filters.status.length > 0 ||
    filters.stage.length > 0 ||
    filters.stale ||
    filters.bookmarked;

  return (
    <div className="search-filter-bar">
      <input
        ref={searchRef}
        type="search"
        className="search-input"
        placeholder="Search by title, number, author, or README content…"
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
              onChange({ query: '', sig: [], status: [], stage: [], stale: false, bookmarked: false })
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
