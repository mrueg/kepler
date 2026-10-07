import Link from 'next/link';
import type { Kep } from '../types/kep';
import { StatusBadge, StageBadge, StaleBadge, BookmarkButton } from './Badges';
import { isStale, formatSig, kepDisplayTitle } from '../utils/kep';

interface KepCardProps {
  kep: Kep;
  isBookmarked?: boolean;
  onToggleBookmark?: (number: string) => void;
}

export function KepCard({ kep, isBookmarked = false, onToggleBookmark }: KepCardProps) {
  // Read the year from the YYYY-MM-DD string; parsing it as a Date would
  // shift Jan 1 into the previous year west of UTC.
  const creationYear = kep['creation-date']?.slice(0, 4);

  return (
    <Link href={`/kep?number=${kep.number}`} className="kep-card">
      <div className="kep-card-number">KEP-{kep.number}</div>
      <h3 className="kep-card-title">{kepDisplayTitle(kep)}</h3>
      <div className="kep-card-sig">{formatSig(kep.sig)}</div>
      <div className="kep-card-badges">
        <StatusBadge status={kep.status} />
        <StageBadge stage={kep.stage} />
        {isStale(kep) && <StaleBadge />}
      </div>
      {creationYear && <div className="kep-card-date">{creationYear}</div>}
      {onToggleBookmark && (
        <BookmarkButton active={isBookmarked} onToggle={() => onToggleBookmark(kep.number)} noun="KEP" />
      )}
    </Link>
  );
}
