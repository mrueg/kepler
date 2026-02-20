import Link from 'next/link';
import type { Kep } from '../types/kep';
import { StatusBadge, StageBadge } from './Badges';

interface KepCardProps {
  kep: Kep;
}

export function KepCard({ kep }: KepCardProps) {
  const sigDisplay = kep.sig.replace(/^sig-/, 'SIG ').replace(/-/g, ' ');
  const titleSlug = kep.slug.replace(/-/g, ' ');

  return (
    <Link href={`/kep?number=${kep.number}`} className="kep-card">
      <div className="kep-card-number">KEP-{kep.number}</div>
      <h3 className="kep-card-title">{kep.title || titleSlug}</h3>
      <div className="kep-card-sig">{sigDisplay}</div>
      <div className="kep-card-badges">
        <StatusBadge status={kep.status} />
        <StageBadge stage={kep.stage} />
      </div>
      {kep['creation-date'] && (
        <div className="kep-card-date">
          {new Date(kep['creation-date']).getFullYear()}
        </div>
      )}
    </Link>
  );
}
