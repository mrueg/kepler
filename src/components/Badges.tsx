import type { KepStatus, KepStage } from '../types/kep';
import type { GepStatus } from '../types/gep';
import { KEP_STATUS_COLORS, KEP_STAGE_COLORS } from '../utils/kep';
import { GEP_STATUS_COLORS, DEFAULT_STATUS_COLOR } from '../utils/gep';

interface BadgeProps {
  text: string;
  color: string;
}

function Badge({ text, color }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.72rem',
        fontWeight: 600,
        textTransform: 'capitalize',
        backgroundColor: color + '22',
        color: color,
        border: `1px solid ${color}44`,
        letterSpacing: '0.02em',
      }}
    >
      {text}
    </span>
  );
}

export function StatusBadge({ status }: { status?: KepStatus }) {
  if (!status) return null;
  return <Badge text={status} color={KEP_STATUS_COLORS[status] ?? '#6b7280'} />;
}

export function StageBadge({ stage }: { stage?: KepStage }) {
  if (!stage) return null;
  return <Badge text={stage} color={KEP_STAGE_COLORS[stage] ?? '#6b7280'} />;
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
  const color = GEP_STATUS_COLORS[status] ?? DEFAULT_STATUS_COLOR;
  return (
    <span className="gep-status-badge" style={{ '--gep-badge-color': color } as React.CSSProperties}>
      {status}
    </span>
  );
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
