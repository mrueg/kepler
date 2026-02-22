'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchKepYaml, fetchKepReadme, parseKepPath, fetchEnhancementPRs } from '../api/github';
import type { Kep } from '../types/kep';
import type { PRInfo } from '../api/github';
import { StatusBadge, StageBadge, StaleBadge } from '../components/Badges';
import { GitHubAvatar } from '../components/GitHubAvatar';
import { MilestoneTimeline } from '../components/MilestoneTimeline';
import { isStale } from '../utils/kep';
import { useBookmarks } from '../hooks/useBookmarks';

export function KepDetailPage({ number }: { number: string }) {
  const [kep, setKep] = useState<Kep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readme, setReadme] = useState<string | null>(null);
  const [prs, setPrs] = useState<PRInfo[]>([]);
  const { isBookmarked, toggleBookmark } = useBookmarks();

  useEffect(() => {
    if (!number) return;

    let cancelled = false;

    async function load() {
      // Try to get from cache first
      const cachedRaw = localStorage.getItem('kepler_keps_v3');
      if (cachedRaw) {
        try {
          const { data } = JSON.parse(cachedRaw) as {
            data: Kep[];
            timestamp: number;
          };
          const found = data.find((k) => k.number === number);
          if (found) {
            if (!cancelled) {
              setKep(found);
              setLoading(false);
            }
            return;
          }
        } catch {
          // ignore
        }
      }

      // Also check tree cache
      const treeCached = localStorage.getItem('kepler_tree_v2');
      if (treeCached) {
        try {
          const { data: paths } = JSON.parse(treeCached) as {
            data: string[];
            timestamp: number;
          };
          const path = paths.find((p) => {
            const info = parseKepPath(p);
            return info?.number === number;
          });
          if (path) {
            try {
              const data = await fetchKepYaml(path);
              if (!cancelled) {
                setKep(data);
                setLoading(false);
              }
            } catch (err) {
              if (!cancelled) {
                setError(
                  err instanceof Error ? err.message : 'Failed to load KEP',
                );
                setLoading(false);
              }
            }
            return;
          }
        } catch {
          // ignore
        }
      }

      if (!cancelled) {
        setError(
          'KEP not found. Please go back to the list and wait for loading to complete.',
        );
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [number]);

  useEffect(() => {
    if (!kep) return;
    let cancelled = false;
    fetchKepReadme(kep.path).then((content) => {
      if (!cancelled) setReadme(content);
    }).catch(() => {
      // README is optional, ignore fetch errors
    });
    fetchEnhancementPRs(kep.number).then((data) => {
      if (!cancelled) setPrs(data);
    }).catch(() => {
      // PR status is optional
    });
    return () => {
      cancelled = true;
    };
  }, [kep]);

  if (loading) {
    return (
      <div className="detail-loading">
        <div className="spinner" />
        <p>Loading KEP-{number}…</p>
      </div>
    );
  }

  if (error || !kep) {
    return (
      <div className="detail-error">
        <p>{error || 'KEP not found'}</p>
        <Link href="/" className="back-link">
          ← Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <div className="detail-back">
        <Link href="/" className="back-link">
          ← All KEPs
        </Link>
      </div>

      <div className="detail-header">
        <div className="detail-kep-number">KEP-{kep.number}</div>
        <h1 className="detail-title">{kep.title}</h1>
        <div className="detail-badges">
          <StatusBadge status={kep.status} />
          <StageBadge stage={kep.stage} />
          {isStale(kep) && <StaleBadge />}
          <button
            className={`bookmark-star bookmark-star-detail${isBookmarked(kep.number) ? ' bookmark-star-active' : ''}`}
            onClick={() => toggleBookmark(kep.number)}
            aria-label={isBookmarked(kep.number) ? 'Remove bookmark' : 'Add bookmark'}
            aria-pressed={isBookmarked(kep.number)}
            title={isBookmarked(kep.number) ? 'Remove bookmark' : 'Bookmark this KEP'}
          >
            {isBookmarked(kep.number) ? '★' : '☆'} {isBookmarked(kep.number) ? 'Bookmarked' : 'Bookmark'}
          </button>
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-meta-grid">
          <MetaItem label="SIG" value={kep.sig?.replace(/^sig-/, 'SIG ').replace(/-/g, ' ')} />
          <MetaItem label="Status" value={kep.status} />
          {kep.stage && <MetaItem label="Stage" value={kep.stage} />}
          {kep['creation-date'] && (
            <MetaItem label="Created" value={kep['creation-date']} />
          )}
          {kep['last-updated'] && (
            <MetaItem label="Last updated" value={kep['last-updated']} />
          )}
          {kep['latest-milestone'] && (
            <MetaItem label="Latest milestone" value={kep['latest-milestone']} />
          )}
        </div>

        {kep.authors && kep.authors.length > 0 && (
          <DetailSection title="Authors">
            <ul className="people-list">
              {kep.authors.map((a) => (
                <li key={a}>
                  <a
                    href={`https://github.com/${a.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gh-link"
                  >
                    <GitHubAvatar username={a} size={20} />
                    @{a.replace(/^@/, '')}
                  </a>
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        {kep.reviewers && kep.reviewers.length > 0 && (
          <DetailSection title="Reviewers">
            <ul className="people-list">
              {kep.reviewers.map((r) => (
                <li key={r}>
                  <a
                    href={`https://github.com/${r.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gh-link"
                  >
                    <GitHubAvatar username={r} size={20} />
                    @{r.replace(/^@/, '')}
                  </a>
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        {kep.approvers && kep.approvers.length > 0 && (
          <DetailSection title="Approvers">
            <ul className="people-list">
              {kep.approvers.map((a) => (
                <li key={a}>
                  <a
                    href={`https://github.com/${a.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gh-link"
                  >
                    <GitHubAvatar username={a} size={20} />
                    @{a.replace(/^@/, '')}
                  </a>
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        {kep.milestone && Object.keys(kep.milestone).length > 0 && (
          <DetailSection title="Milestones">
            <MilestoneTimeline milestone={kep.milestone} stage={kep.stage} />
          </DetailSection>
        )}

        {kep['participating-sigs'] && kep['participating-sigs'].length > 0 && (
          <DetailSection title="Participating SIGs">
            <p>{kep['participating-sigs'].join(', ')}</p>
          </DetailSection>
        )}

        {kep['see-also'] && kep['see-also'].length > 0 && (
          <DetailSection title="See Also">
            <ul className="see-also-list">
              {kep['see-also'].map((ref) => (
                <li key={ref}><KepRef value={ref} /></li>
              ))}
            </ul>
          </DetailSection>
        )}

        {kep.replaces && kep.replaces.length > 0 && (
          <DetailSection title="Replaces">
            <ul className="see-also-list">
              {kep.replaces.map((ref) => (
                <li key={ref}><KepRef value={ref} /></li>
              ))}
            </ul>
          </DetailSection>
        )}

        {kep['superseded-by'] && kep['superseded-by'].length > 0 && (
          <DetailSection title="Superseded By">
            <ul className="see-also-list">
              {kep['superseded-by'].map((ref) => (
                <li key={ref}><KepRef value={ref} /></li>
              ))}
            </ul>
          </DetailSection>
        )}

        {prs.length > 0 && (
          <DetailSection title="Enhancement PRs">
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
                    <PRCIBadge status={pr.ciStatus} />
                    <PRReviewBadge status={pr.reviewStatus} />
                  </div>
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        <div className="detail-github-link">
          <a
            href={kep.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="github-btn"
          >
            View on GitHub →
          </a>
        </div>
      </div>

      {readme && (
        <div className="detail-readme">
          <h2 className="detail-readme-title">README</h2>
          <div className="detail-readme-body">
            <Markdown remarkPlugins={[remarkGfm]} skipHtml>{readme}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}

function PRStateBadge({ state, merged, draft }: { state: 'open' | 'closed'; merged: boolean; draft: boolean }) {
  if (merged) return <span className="pr-badge pr-badge-merged">Merged</span>;
  if (state === 'closed') return <span className="pr-badge pr-badge-closed">Closed</span>;
  if (draft) return <span className="pr-badge pr-badge-draft">Draft</span>;
  return <span className="pr-badge pr-badge-open">Open</span>;
}

function PRCIBadge({ status }: { status: PRInfo['ciStatus'] }) {
  if (status === 'unknown') return null;
  const map: Record<string, { label: string; cls: string }> = {
    success: { label: '✓ CI Passing', cls: 'pr-ci-success' },
    failure: { label: '✗ CI Failing', cls: 'pr-ci-failure' },
    pending: { label: '⏳ CI Pending', cls: 'pr-ci-pending' },
  };
  const info = map[status];
  if (!info) return null;
  return <span className={`pr-badge ${info.cls}`}>{info.label}</span>;
}

function PRReviewBadge({ status }: { status: PRInfo['reviewStatus'] }) {
  if (status === 'none') return null;
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: '✓ Approved', cls: 'pr-review-approved' },
    changes_requested: { label: '✗ Changes Requested', cls: 'pr-review-changes' },
    pending: { label: '⏳ Review Pending', cls: 'pr-review-pending' },
  };
  const info = map[status];
  if (!info) return null;
  return <span className={`pr-badge ${info.cls}`}>{info.label}</span>;
}

function MetaItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="meta-item">
      <dt className="meta-label">{label}</dt>
      <dd className="meta-value">{value}</dd>
    </div>
  );
}

function DetailSection({
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

function extractKepNumber(ref: string): string | null {
  // Match plain number: "1234"
  if (/^\d+$/.test(ref.trim())) return ref.trim();
  // Match "kep-1234" or "KEP-1234"
  const kepPrefix = ref.match(/^kep-(\d+)/i);
  if (kepPrefix) return kepPrefix[1];
  // Match path like "/keps/sig-xxx/1234-slug/..." or "keps/sig-xxx/1234-slug/..."
  const pathMatch = ref.match(/(?:^|\/)(\d+)-[^/]+/);
  if (pathMatch) return pathMatch[1];
  return null;
}

function KepRef({ value }: { value: string }) {
  const number = extractKepNumber(value);
  if (number) {
    return (
      <Link href={`/kep?number=${number}`} className="kep-ref-link">
        {value}
      </Link>
    );
  }
  if (/^https?:\/\//.test(value)) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="kep-ref-link">
        {value}
      </a>
    );
  }
  return <>{value}</>;
}
