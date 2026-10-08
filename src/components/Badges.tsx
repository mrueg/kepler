import type { KepStatus, KepStage } from '../types/kep';
import type { GepStatus } from '../types/gep';
import { KEP_STATUS_COLORS, KEP_STAGE_COLORS } from '../utils/kep';
import { GEP_STATUS_COLORS, DEFAULT_STATUS_COLOR } from '../utils/gep';

function Badge({ text, color, capitalize = false }: { text: string; color: string; capitalize?: boolean }) {
  return (
    <span
      className={`status-badge${capitalize ? ' status-badge--capitalize' : ''}`}
      style={{ '--badge-color': color } as React.CSSProperties}
    >
      {text}
    </span>
  );
}

export function StatusBadge({ status }: { status?: KepStatus }) {
  if (!status) return null;
  return <Badge text={status} color={KEP_STATUS_COLORS[status] ?? '#6b7280'} capitalize />;
}

export function StageBadge({ stage }: { stage?: KepStage }) {
  if (!stage) return null;
  return <Badge text={stage} color={KEP_STAGE_COLORS[stage] ?? '#6b7280'} capitalize />;
}

export function StaleBadge() {
  return (
    <span className="stale-badge" title="This KEP has not been updated in over a year">
      ⚠ Stale
    </span>
  );
}

export function GepStatusBadge({ status }: { status?: GepStatus }) {
  if (!status) return null;
  return <Badge text={status} color={GEP_STATUS_COLORS[status] ?? DEFAULT_STATUS_COLOR} />;
}

interface BookmarkButtonProps {
  active: boolean;
  onToggle: () => void;
  /** "KEP" or "GEP", used in the tooltip. */
  noun: string;
  /** Detail-page variant: larger, with a text label. */
  detail?: boolean;
}

export function BookmarkButton({ active, onToggle, noun, detail = false }: BookmarkButtonProps) {
  return (
    <button
      className={`bookmark-star${detail ? ' bookmark-star-detail' : ''}${active ? ' bookmark-star-active' : ''}`}
      onClick={onToggle}
      aria-label={active ? 'Remove bookmark' : 'Add bookmark'}
      aria-pressed={active}
      title={active ? 'Remove bookmark' : `Bookmark this ${noun}`}
    >
      {active ? '★' : '☆'}
      {detail && (active ? ' Bookmarked' : ' Bookmark')}
    </button>
  );
}
