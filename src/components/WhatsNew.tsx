import Link from 'next/link';
import type { Kep } from '../types/kep';
import type { Gep } from '../types/gep';
import type { Caep } from '../types/caep';
import type { GitChange } from '../api/shared';
import { StatusBadge, GepStatusBadge, CaepStatusBadge } from './Badges';
import { caepHref } from '../api/clusterapi';
import { daysSince, kepDisplayTitle } from '../utils/kep';

const MAX_ITEMS = 10;

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
  recentKepChanges?: GitChange[];
  recentGepChanges?: GitChange[];
  caeps?: Caep[];
  /** GitChange.number is the CAEP id. */
  recentCaepChanges?: GitChange[];
  loading?: boolean;
}

export function WhatsNew({
  keps = [],
  geps = [],
  caeps = [],
  recentKepChanges,
  recentGepChanges,
  recentCaepChanges,
  loading = false,
}: WhatsNewProps) {
  const kepByNumber = new Map(keps.map((k) => [k.number, k]));
  const gepByNumber = new Map(geps.map((g) => [String(g.number), g]));

  const recentKeps = (recentKepChanges ?? [])
    .slice(0, MAX_ITEMS)
    .map(({ number, date }) => ({ kep: kepByNumber.get(number), date }))
    .filter((item): item is { kep: Kep; date: Date } => item.kep !== undefined);

  const recentGeps = (recentGepChanges ?? [])
    .slice(0, MAX_ITEMS)
    .map(({ number, date }) => ({ gep: gepByNumber.get(number), date }))
    .filter((item): item is { gep: Gep; date: Date } => item.gep !== undefined);

  const caepById = new Map(caeps.map((c) => [c.id, c]));
  const recentCaeps = (recentCaepChanges ?? [])
    .slice(0, MAX_ITEMS)
    .map(({ number: id, date }) => ({ caep: caepById.get(id), date }))
    .filter((item): item is { caep: Caep; date: Date } => item.caep !== undefined);

  const hasKeps = recentKeps.length > 0;
  const hasGeps = recentGeps.length > 0;
  const hasCaeps = recentCaeps.length > 0;

  if (!loading && !hasKeps && !hasGeps && !hasCaeps) return null;

  return (
    <aside className="whats-new">
      <h2 className="whats-new-title">What&apos;s New</h2>

      {loading && (
        <div className="whats-new-loading">Loading…</div>
      )}

      {!loading && hasKeps && (
        <section className="whats-new-section">
          <div className="whats-new-section-label">Recently changed KEPs</div>
          <ul className="whats-new-list">
            {recentKeps.map(({ kep, date }) => (
              <li key={kep.path} className="whats-new-item">
                <Link href={`/kep?number=${kep.number}`} className="whats-new-link">
                  <span className="whats-new-number">KEP-{kep.number}</span>
                  <span className="whats-new-item-title">{kepDisplayTitle(kep)}</span>
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

      {!loading && hasGeps && (
        <section className="whats-new-section">
          <div className="whats-new-section-label">Recently changed GEPs</div>
          <ul className="whats-new-list">
            {recentGeps.map(({ gep, date }) => (
              <li key={gep.path} className="whats-new-item">
                <Link href={`/gep?number=${gep.number}`} className="whats-new-link">
                  <span className="whats-new-number">GEP-{gep.number}</span>
                  <span className="whats-new-item-title">{gep.name}</span>
                </Link>
                <div className="whats-new-meta">
                  <GepStatusBadge status={gep.status} />
                  <RelativeTime date={date} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && hasCaeps && (
        <section className="whats-new-section">
          <div className="whats-new-section-label">Recently changed CAEPs</div>
          <ul className="whats-new-list">
            {recentCaeps.map(({ caep, date }) => (
              <li key={caep.path} className="whats-new-item">
                <Link href={caepHref(caep.id)} className="whats-new-link">
                  <span className="whats-new-number">CAEP · {caep.date}</span>
                  <span className="whats-new-item-title">{caep.title}</span>
                </Link>
                <div className="whats-new-meta">
                  <CaepStatusBadge status={caep.status} />
                  <RelativeTime date={date} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
