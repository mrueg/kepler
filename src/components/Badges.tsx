import type { KepStatus, KepStage } from '../types/kep';

const STATUS_COLORS: Record<KepStatus, string> = {
  provisional: '#f59e0b',
  implementable: '#3b82f6',
  implemented: '#10b981',
  deferred: '#6b7280',
  rejected: '#ef4444',
  withdrawn: '#9ca3af',
  replaced: '#8b5cf6',
};

const STAGE_COLORS: Record<KepStage, string> = {
  'pre-alpha': '#9ca3af',
  alpha: '#f59e0b',
  beta: '#3b82f6',
  stable: '#10b981',
};

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
  return <Badge text={status} color={STATUS_COLORS[status] ?? '#6b7280'} />;
}

export function StageBadge({ stage }: { stage?: KepStage }) {
  if (!stage) return null;
  return <Badge text={stage} color={STAGE_COLORS[stage] ?? '#6b7280'} />;
}

export function StaleBadge() {
  return (
    <span className="stale-badge" title="This KEP has not been updated in over a year">
      ⚠ Stale
    </span>
  );
}
