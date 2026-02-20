import Link from 'next/link';
import type { Kep } from '../types/kep';
import { StatusBadge, StaleBadge } from './Badges';
import { isStale } from '../utils/kep';

interface KepTableProps {
  keps: Kep[];
}

export function KepTable({ keps }: KepTableProps) {
  return (
    <div className="kep-table-wrapper">
      <table className="kep-table">
        <thead>
          <tr>
            <th className="kep-table-th kep-table-th-number">Number</th>
            <th className="kep-table-th kep-table-th-title">Title</th>
            <th className="kep-table-th kep-table-th-sig">SIG</th>
            <th className="kep-table-th kep-table-th-status">Status</th>
            <th className="kep-table-th kep-table-th-date">Last Updated</th>
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
                <td className="kep-table-td kep-table-td-date">{dateDisplay}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
