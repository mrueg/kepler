'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchGepYaml, fetchGepContent, parseGepPath, buildGepPath, fetchGatewayApiPRs, CACHE_KEY_GEPS, CACHE_KEY_GEP_TREE } from '../api/gatewayapi';
import type { Gep, GepStatus } from '../types/gep';
import type { GepPRInfo } from '../api/gatewayapi';
import { GitHubAvatar } from '../components/GitHubAvatar';
import { useGepBookmarks } from '../hooks/useGepBookmarks';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';

const GEP_STATUS_COLORS: Record<GepStatus, string> = {
  Memorandum: '#6e40c9',
  Provisional: '#e2a03f',
  Experimental: '#326ce5',
  Standard: '#2ea043',
  Declined: '#cf222e',
  Deferred: '#8b949e',
  Withdrawn: '#9a6700',
};

function GepStatusBadge({ status }: { status?: GepStatus }) {
  if (!status) return null;
  const color = GEP_STATUS_COLORS[status] ?? '#8b949e';
  return (
    <span className="gep-status-badge" style={{ '--gep-badge-color': color } as React.CSSProperties}>
      {status}
    </span>
  );
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

export function GepDetailPage({ number }: { number: string }) {
  const router = useRouter();
  const [gep, setGep] = useState<Gep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [prs, setPrs] = useState<GepPRInfo[]>([]);
  const { isBookmarked, toggleBookmark } = useGepBookmarks();

  // Build sorted list of GEP numbers from cache for keyboard navigation
  const getSortedGepNumbers = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(CACHE_KEY_GEPS);
      if (raw) {
        const { data } = JSON.parse(raw) as { data: Gep[]; timestamp: number };
        return data.map((g) => String(g.number)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      }
    } catch {
      // ignore
    }
    return [];
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'b') {
      toggleBookmark(number);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const numbers = getSortedGepNumbers();
      const idx = numbers.indexOf(number);
      if (idx === -1) return;
      const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
      if (nextIdx >= 0 && nextIdx < numbers.length) {
        router.push(`/gep?number=${numbers[nextIdx]}`);
      }
    }
  }, [number, toggleBookmark, getSortedGepNumbers, router]);

  useKeyboardShortcut(handleKeyDown);

  useEffect(() => {
    if (!number) return;

    let cancelled = false;

    async function load() {
      // Try to get from cache first
      const cachedRaw = localStorage.getItem(CACHE_KEY_GEPS);
      if (cachedRaw) {
        try {
          const { data } = JSON.parse(cachedRaw) as {
            data: Gep[];
            timestamp: number;
          };
          const found = data.find((g) => String(g.number) === number);
          if (found) {
            if (!cancelled) {
              setGep(found);
              setLoading(false);
            }
            return;
          }
        } catch {
          // ignore
        }
      }

      // Also check tree cache
      const treeCached = localStorage.getItem(CACHE_KEY_GEP_TREE);
      if (treeCached) {
        try {
          const { data: paths } = JSON.parse(treeCached) as {
            data: string[];
            timestamp: number;
          };
          const path = paths.find((p) => {
            const info = parseGepPath(p);
            return info?.number === number;
          });
          if (path) {
            try {
              const data = await fetchGepYaml(path);
              if (!cancelled) {
                setGep(data);
                setLoading(false);
              }
            } catch (err) {
              if (!cancelled) {
                setError(
                  err instanceof Error ? err.message : 'Failed to load GEP',
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

      // Fetch directly if not in cache
      try {
        const path = buildGepPath(number);
        const data = await fetchGepYaml(path);
        if (!cancelled) {
          setGep(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'GEP not found.',
          );
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [number]);

  useEffect(() => {
    if (!gep) return;
    let cancelled = false;
    fetchGepContent(gep.path).then((c) => {
      if (!cancelled) setContent(c);
    }).catch(() => {
      // content is optional
    });
    if (gep.changelog && gep.changelog.length > 0) {
      fetchGatewayApiPRs(gep.changelog).then((data) => {
        if (!cancelled) setPrs(data);
      }).catch(() => {
        // PR status is optional
      });
    }
    return () => {
      cancelled = true;
    };
  }, [gep]);

  if (loading) {
    return (
      <div className="detail-loading">
        <div className="spinner" />
        <p>Loading GEP-{number}…</p>
      </div>
    );
  }

  if (error || !gep) {
    return (
      <div className="detail-error">
        <p>{error || 'GEP not found'}</p>
        <Link href="/gep" className="back-link">
          ← Back to GEPs
        </Link>
      </div>
    );
  }

  const gepNumber = String(gep.number);
  const bookmarked = isBookmarked(gepNumber);

  return (
    <div className="detail-page">
      <div className="detail-back">
        <Link href="/gep" className="back-link">
          ← All GEPs
        </Link>
      </div>

      <div className="detail-header">
        <div className="detail-kep-number">GEP-{gepNumber}</div>
        <h1 className="detail-title">{gep.name}</h1>
        <div className="detail-badges">
          <GepStatusBadge status={gep.status} />
          <button
            className={`bookmark-star bookmark-star-detail${bookmarked ? ' bookmark-star-active' : ''}`}
            onClick={() => toggleBookmark(gepNumber)}
            aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
            aria-pressed={bookmarked}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark this GEP'}
          >
            {bookmarked ? '★' : '☆'} {bookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-meta-grid">
          <MetaItem label="Status" value={gep.status} />
          <MetaItem label="Number" value={gepNumber} />
        </div>

        {gep.authors && gep.authors.length > 0 && (
          <DetailSection title="Authors">
            <ul className="people-list">
              {gep.authors.map((a) => (
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

        {gep.relationships && (
          <>
            {gep.relationships.obsoletes && gep.relationships.obsoletes.length > 0 && (
              <DetailSection title="Obsoletes">
                <ul className="see-also-list">
                  {gep.relationships.obsoletes.map((r) => (
                    <li key={r.number}>
                      <Link href={`/gep?number=${r.number}`} className="kep-ref-link">
                        GEP-{r.number}: {r.name}
                      </Link>
                      {r.description && (
                        <span className="gep-rel-desc"> — {r.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </DetailSection>
            )}
            {gep.relationships.extends && gep.relationships.extends.length > 0 && (
              <DetailSection title="Extends">
                <ul className="see-also-list">
                  {gep.relationships.extends.map((r) => (
                    <li key={r.number}>
                      <Link href={`/gep?number=${r.number}`} className="kep-ref-link">
                        GEP-{r.number}: {r.name}
                      </Link>
                      {r.description && (
                        <span className="gep-rel-desc"> — {r.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </DetailSection>
            )}
            {gep.relationships.seeAlso && gep.relationships.seeAlso.length > 0 && (
              <DetailSection title="See Also">
                <ul className="see-also-list">
                  {gep.relationships.seeAlso.map((r) => (
                    <li key={r.number}>
                      <Link href={`/gep?number=${r.number}`} className="kep-ref-link">
                        GEP-{r.number}: {r.name}
                      </Link>
                      {r.description && (
                        <span className="gep-rel-desc"> — {r.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </DetailSection>
            )}
          </>
        )}

        {gep.references && gep.references.length > 0 && (
          <DetailSection title="References">
            <ul className="see-also-list">
              {gep.references.map((ref) => (
                <li key={ref}>
                  <a href={ref} target="_blank" rel="noopener noreferrer" className="gep-ref-link">
                    {ref}
                  </a>
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        {(prs.length > 0 || (gep.changelog && gep.changelog.length > 0)) && (
          <DetailSection title="Changelog PRs">
            {prs.length > 0 ? (
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
            ) : (
              <ul className="see-also-list">
                {gep.changelog!.map((pr) => (
                  <li key={pr}>
                    <a href={pr} target="_blank" rel="noopener noreferrer" className="gep-ref-link">
                      {pr}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>
        )}

        <div className="detail-github-link">
          <a
            href={gep.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="github-btn"
          >
            View on GitHub →
          </a>
        </div>
      </div>

      {content && (
        <div className="detail-readme">
          <h2 className="detail-readme-title">Content</h2>
          <div className="detail-readme-body">
            <Markdown remarkPlugins={[remarkGfm]} skipHtml>{content}</Markdown>
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

function PRCIBadge({ status }: { status: GepPRInfo['ciStatus'] }) {
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

function PRReviewBadge({ status }: { status: GepPRInfo['reviewStatus'] }) {
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
