import type { ChangelogEntry } from '../api/github';
import { GitHubAvatar } from './GitHubAvatar';

const STATUS_COLORS: Record<string, string> = {
  provisional: '#f59e0b',
  implementable: '#3b82f6',
  implemented: '#10b981',
  deferred: '#6b7280',
  rejected: '#ef4444',
  withdrawn: '#9ca3af',
  replaced: '#8b5cf6',
};

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface ChangelogTimelineProps {
  entries: ChangelogEntry[];
}

export function ChangelogTimeline({ entries }: ChangelogTimelineProps) {
  if (!entries.length) return <p className="changelog-empty">No status history available.</p>;

  return (
    <ol className="changelog-timeline" aria-label="Status change history">
      {entries.map((entry, i) => {
        const color = STATUS_COLORS[entry.status] ?? '#6b7280';
        const isLast = i === entries.length - 1;
        return (
          <li key={entry.sha} className="changelog-entry">
            <div className="changelog-track" aria-hidden="true">
              <div
                className="changelog-dot"
                style={{ background: color, borderColor: color }}
              />
              {!isLast && <div className="changelog-line" />}
            </div>
            <div className="changelog-content">
              <div className="changelog-header">
                <span
                  className="changelog-status-badge"
                  style={{
                    backgroundColor: color + '22',
                    color,
                    border: `1px solid ${color}44`,
                  }}
                >
                  {entry.status}
                </span>
                <span className="changelog-date">{formatDate(entry.date)}</span>
                <a
                  href={`https://github.com/${entry.author}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="changelog-author"
                >
                  <GitHubAvatar username={entry.author} size={16} />
                  @{entry.author}
                </a>
              </div>
              <a
                href={`https://github.com/kubernetes/enhancements/commit/${entry.sha}`}
                target="_blank"
                rel="noopener noreferrer"
                className="changelog-message"
              >
                {entry.message}
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
