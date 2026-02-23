import Link from 'next/link';
import type { Kep } from '../types/kep';
import { StatusBadge, StageBadge, StaleBadge } from './Badges';
import { isStale } from '../utils/kep';

export type SortKey = 'title' | 'sig' | 'status' | 'stage' | 'last-updated';

interface KepTableProps {
  keps: Kep[];
  isBookmarked?: (number: string) => boolean;
  onToggleBookmark?: (number: string) => void;
  sortKey?: SortKey;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: SortKey) => void;
}

function SortIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`sort-indicator${active ? ' sort-indicator-active' : ''}`} aria-hidden="true">
      {active ? (dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
    </span>
  );
}

export function KepTable({ keps, isBookmarked, onToggleBookmark, sortKey, sortDir = 'asc', onSort }: KepTableProps) {
  function thProps(key: SortKey, label: string, extraClass: string) {
    if (!onSort) return { className: `kep-table-th ${extraClass}`, children: label };
    const isActive = sortKey === key;
    return {
      className: `kep-table-th kep-table-th-sortable ${extraClass}${isActive ? ' kep-table-th-sorted' : ''}`,
      onClick: () => onSort(key),
      'aria-sort': (isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none') as 'ascending' | 'descending' | 'none',
      children: (
        <>
          {label}
          <SortIndicator active={isActive} dir={sortDir} />
        </>
      ),
    };
  }

  return (
    <div className="kep-table-wrapper">
      <table className="kep-table">
        <thead>
          <tr>
            <th className="kep-table-th kep-table-th-number">Number</th>
            <th {...thProps('title', 'Title', 'kep-table-th-title')} />
            <th {...thProps('sig', 'SIG', 'kep-table-th-sig')} />
            <th {...thProps('status', 'Status', 'kep-table-th-status')} />
            <th {...thProps('stage', 'Stage', 'kep-table-th-stage')} />
            <th {...thProps('last-updated', 'Last Updated', 'kep-table-th-date')} />
            {onToggleBookmark && (
              <th className="kep-table-th kep-table-th-bookmark" aria-label="Bookmark" />
            )}
          </tr>
        </thead>
        <tbody>
          {keps.map((kep) => {
            const sigDisplay = kep.sig.replace(/^sig-/, 'SIG ').replace(/-/g, ' ');
            const titleSlug = kep.slug.replace(/-/g, ' ');
            const lastUpdated = kep['last-updated'] ?? kep['creation-date'];
            const dateDisplay = lastUpdated
              ? new Date(lastUpdated).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '—';
            const bookmarked = isBookmarked?.(kep.number) ?? false;

            return (
              <tr key={kep.path} className="kep-table-row">
                <td className="kep-table-td kep-table-td-number">
                  <Link href={`/kep?number=${kep.number}`} className="kep-table-number-link">
                    KEP-{kep.number}
                  </Link>
                </td>
                <td className="kep-table-td kep-table-td-title">
                  <Link href={`/kep?number=${kep.number}`} className="kep-table-title-link">
                    {kep.title || titleSlug}
                  </Link>
                </td>
                <td className="kep-table-td kep-table-td-sig">{sigDisplay}</td>
                <td className="kep-table-td kep-table-td-status">
                  <StatusBadge status={kep.status} />
                  {isStale(kep) && <StaleBadge />}
                </td>
                <td className="kep-table-td kep-table-td-stage">
                  <StageBadge stage={kep.stage} />
                </td>
                <td className="kep-table-td kep-table-td-date">{dateDisplay}</td>
                {onToggleBookmark && (
                  <td className="kep-table-td kep-table-td-bookmark">
                    <button
                      className={`bookmark-star${bookmarked ? ' bookmark-star-active' : ''}`}
                      onClick={() => onToggleBookmark(kep.number)}
                      aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                      aria-pressed={bookmarked}
                      title={bookmarked ? 'Remove bookmark' : 'Bookmark this KEP'}
                    >
                      {bookmarked ? '★' : '☆'}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
