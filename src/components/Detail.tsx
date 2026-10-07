import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PRInfo } from '../api/shared';
import { GitHubAvatar } from './GitHubAvatar';

export function MetaItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="meta-item">
      <dt className="meta-label">{label}</dt>
      <dd className="meta-value">{value}</dd>
    </div>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="detail-section">
      <h3 className="detail-section-title">{title}</h3>
      {children}
    </div>
  );
}

/** A titled list of GitHub users with avatars; renders nothing when empty. */
export function PeopleSection({ title, people }: { title: string; people?: string[] }) {
  if (!people || people.length === 0) return null;
  return (
    <DetailSection title={title}>
      <ul className="people-list">
        {people.map((person) => {
          const handle = person.replace(/^@/, '');
          return (
            <li key={person}>
              <a
                href={`https://github.com/${handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="gh-link"
              >
                <GitHubAvatar username={handle} size={20} />
                @{handle}
              </a>
            </li>
          );
        })}
      </ul>
    </DetailSection>
  );
}

function PRStateBadge({ state, merged, draft }: { state: PRInfo['state']; merged: boolean; draft: boolean }) {
  if (merged) return <span className="pr-badge pr-badge-merged">Merged</span>;
  if (state === 'closed') return <span className="pr-badge pr-badge-closed">Closed</span>;
  if (draft) return <span className="pr-badge pr-badge-draft">Draft</span>;
  return <span className="pr-badge pr-badge-open">Open</span>;
}

const CI_BADGES: Record<Exclude<PRInfo['ciStatus'], 'unknown'>, { label: string; cls: string }> = {
  success: { label: '✓ CI Passing', cls: 'pr-ci-success' },
  failure: { label: '✗ CI Failing', cls: 'pr-ci-failure' },
  pending: { label: '⏳ CI Pending', cls: 'pr-ci-pending' },
};

const REVIEW_BADGES: Record<Exclude<PRInfo['reviewStatus'], 'none'>, { label: string; cls: string }> = {
  approved: { label: '✓ Approved', cls: 'pr-review-approved' },
  changes_requested: { label: '✗ Changes Requested', cls: 'pr-review-changes' },
  pending: { label: '⏳ Review Pending', cls: 'pr-review-pending' },
};

function StatusBadge({ info }: { info?: { label: string; cls: string } }) {
  if (!info) return null;
  return <span className={`pr-badge ${info.cls}`}>{info.label}</span>;
}

export function PRList({ prs }: { prs: PRInfo[] }) {
  return (
    <ul className="pr-list">
      {prs.map((pr) => (
        <li key={pr.number} className="pr-item">
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="pr-link"
          >
            <span className="pr-number">#{pr.number}</span>
            <span className="pr-title">{pr.title}</span>
          </a>
          <div className="pr-badges">
            <PRStateBadge state={pr.state} merged={!!pr.merged_at} draft={pr.draft} />
            <StatusBadge info={pr.ciStatus === 'unknown' ? undefined : CI_BADGES[pr.ciStatus]} />
            <StatusBadge info={pr.reviewStatus === 'none' ? undefined : REVIEW_BADGES[pr.reviewStatus]} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function GitHubLink({ href }: { href: string }) {
  return (
    <div className="detail-github-link">
      <a href={href} target="_blank" rel="noopener noreferrer" className="github-btn">
        View on GitHub →
      </a>
    </div>
  );
}

export function MarkdownSection({ title, markdown }: { title: string; markdown: string }) {
  return (
    <div className="detail-readme">
      <h2 className="detail-readme-title">{title}</h2>
      <div className="detail-readme-body">
        <Markdown remarkPlugins={[remarkGfm]} skipHtml>{markdown}</Markdown>
      </div>
    </div>
  );
}
