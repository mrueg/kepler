import Link from 'next/link';
import type { Kep } from '../types/kep';
import type { Gep } from '../types/gep';
import { StatusBadge } from './Badges';
import { GEP_STATUS_COLORS } from '../utils/gep';
import { getRecentKeps, daysSince } from '../utils/kep';

const MAX_ITEMS = 10;
const DEFAULT_STATUS_COLOR = '#8b949e';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function RelativeTime({ date }: { date: Date }) {
  const days = daysSince(date);
  let label: string;
  if (days === 0) label = 'today';
  else if (days === 1) label = 'yesterday';
  else label = `${days}d ago`;
  return <span title={formatDate(date)} className="whats-new-relative">{label}</span>;
}

interface WhatsNewProps {
  keps?: Kep[];
  geps?: Gep[];
  loading?: boolean;
}

export function WhatsNew({ keps = [], geps = [], loading = false }: WhatsNewProps) {
  const recentKeps = getRecentKeps(keps, MAX_ITEMS);

  // GEPs have no date field; show the most recently numbered ones as "new"
  const recentGeps = [...geps]
    .sort((a, b) => Number(b.number) - Number(a.number))
    .slice(0, MAX_ITEMS);

  const hasKeps = recentKeps.length > 0;
  const hasGeps = geps.length > 0 && recentGeps.length > 0;

  if (!loading && !hasKeps && !hasGeps) return null;

  return (
    <aside className="whats-new">
      <h2 className="whats-new-title">🆕 What&apos;s New</h2>

      {loading && (
        <div className="whats-new-loading">Loading…</div>
      )}

      {!loading && hasKeps && (
        <section className="whats-new-section">
          <div className="whats-new-section-label">KEPs updated in the last 30 days</div>
          <ul className="whats-new-list">
            {recentKeps.map(({ kep, date }) => (
              <li key={kep.path} className="whats-new-item">
                <Link href={`/kep?number=${kep.number}`} className="whats-new-link">
                  <span className="whats-new-number">KEP-{kep.number}</span>
                  <span className="whats-new-item-title">{kep.title || kep.slug.replace(/-/g, ' ')}</span>
                </Link>
                <div className="whats-new-meta">
                  <StatusBadge status={kep.status} />
                  <RelativeTime date={date} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && !hasKeps && keps.length > 0 && (
        <div className="whats-new-empty">No KEPs updated in the last 30 days.</div>
      )}

      {!loading && hasGeps && (
        <section className="whats-new-section">
          <div className="whats-new-section-label">Recently added GEPs</div>
          <ul className="whats-new-list">
            {recentGeps.map((gep) => (
              <li key={gep.path} className="whats-new-item">
                <Link href={`/gep?number=${gep.number}`} className="whats-new-link">
                  <span className="whats-new-number">GEP-{gep.number}</span>
                  <span className="whats-new-item-title">{gep.name}</span>
                </Link>
                <div className="whats-new-meta">
                  <span
                    className="gep-status-badge"
                    style={{ '--gep-badge-color': GEP_STATUS_COLORS[gep.status] ?? DEFAULT_STATUS_COLOR } as React.CSSProperties}
                  >
                    {gep.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
