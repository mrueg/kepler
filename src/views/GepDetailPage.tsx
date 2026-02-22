'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchGepYaml, fetchGepContent, parseGepPath, buildGepPath } from '../api/gatewayapi';
import type { Gep, GepStatus } from '../types/gep';
import { GitHubAvatar } from '../components/GitHubAvatar';

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
  const [gep, setGep] = useState<Gep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!number) return;

    let cancelled = false;

    async function load() {
      // Try to get from cache first
      const cachedRaw = localStorage.getItem('kepler_geps_v1');
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
      const treeCached = localStorage.getItem('kepler_gep_tree_v1');
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

  return (
    <div className="detail-page">
      <div className="detail-back">
        <Link href="/gep" className="back-link">
          ← All GEPs
        </Link>
      </div>

      <div className="detail-header">
        <div className="detail-kep-number">GEP-{gep.number}</div>
        <h1 className="detail-title">{gep.name}</h1>
        <div className="detail-badges">
          <GepStatusBadge status={gep.status} />
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-meta-grid">
          <MetaItem label="Status" value={gep.status} />
          <MetaItem label="Number" value={String(gep.number)} />
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

        {gep.changelog && gep.changelog.length > 0 && (
          <DetailSection title="Changelog PRs">
            <ul className="see-also-list">
              {gep.changelog.map((pr) => (
                <li key={pr}>
                  <a href={pr} target="_blank" rel="noopener noreferrer" className="gep-ref-link">
                    {pr}
                  </a>
                </li>
              ))}
            </ul>
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
