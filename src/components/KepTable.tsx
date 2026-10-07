import Link from 'next/link';
import type { Kep } from '../types/kep';
import { StatusBadge, StageBadge, StaleBadge, BookmarkButton } from './Badges';
import { SortableTh } from './Controls';
import { isStale, getKepDate, formatKepDate, formatSig, kepDisplayTitle, type KepSortKey, type SortDir } from '../utils/kep';

interface KepTableProps {
  keps: Kep[];
  isBookmarked?: (number: string) => boolean;
  onToggleBookmark?: (number: string) => void;
  sortKey?: KepSortKey;
  sortDir?: SortDir;
  onSort?: (key: KepSortKey) => void;
}

export function KepTable({ keps, isBookmarked, onToggleBookmark, sortKey, sortDir = 'asc', onSort }: KepTableProps) {
  const sortProps = { activeKey: sortKey, dir: sortDir, onSort };

  return (
    <div className="kep-table-wrapper">
      <table className="kep-table">
        <thead>
          <tr>
            <th className="kep-table-th kep-table-th-number">Number</th>
            <SortableTh sortKey="title" label="Title" className="kep-table-th-title" {...sortProps} />
            <SortableTh sortKey="sig" label="SIG" className="kep-table-th-sig" {...sortProps} />
            <SortableTh sortKey="status" label="Status" className="kep-table-th-status" {...sortProps} />
            <SortableTh sortKey="stage" label="Stage" className="kep-table-th-stage" {...sortProps} />
            <SortableTh sortKey="last-updated" label="Last Updated" className="kep-table-th-date" {...sortProps} />
            {onToggleBookmark && (
              <th className="kep-table-th kep-table-th-bookmark" aria-label="Bookmark" />
            )}
          </tr>
        </thead>
        <tbody>
          {keps.map((kep) => {
            const date = getKepDate(kep);
            return (
              <tr key={kep.path} className="kep-table-row">
                <td className="kep-table-td kep-table-td-number">
                  <Link href={`/kep?number=${kep.number}`} className="kep-table-number-link">
                    KEP-{kep.number}
                  </Link>
                </td>
                <td className="kep-table-td kep-table-td-title">
                  <Link href={`/kep?number=${kep.number}`} className="kep-table-title-link">
                    {kepDisplayTitle(kep)}
                  </Link>
                </td>
                <td className="kep-table-td kep-table-td-sig">{formatSig(kep.sig)}</td>
                <td className="kep-table-td kep-table-td-status">
                  <StatusBadge status={kep.status} />
                  {isStale(kep) && <StaleBadge />}
                </td>
                <td className="kep-table-td kep-table-td-stage">
                  <StageBadge stage={kep.stage} />
                </td>
                <td className="kep-table-td kep-table-td-date">{date ? formatKepDate(date) : '—'}</td>
                {onToggleBookmark && (
                  <td className="kep-table-td kep-table-td-bookmark">
                    <BookmarkButton
                      active={isBookmarked?.(kep.number) ?? false}
                      onToggle={() => onToggleBookmark(kep.number)}
                      noun="KEP"
                    />
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
