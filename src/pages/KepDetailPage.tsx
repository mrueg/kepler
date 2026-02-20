import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchKepYaml, parseKepPath } from '../api/github';
import type { Kep } from '../types/kep';
import { StatusBadge, StageBadge } from '../components/Badges';

export function KepDetailPage() {
  const { number } = useParams<{ number: string }>();
  const [kep, setKep] = useState<Kep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!number) return;

    let cancelled = false;

    async function load() {
      // Try to get from cache first
      const cachedRaw = localStorage.getItem('kepler_keps_v2');
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
        <Link to="/" className="back-link">
          ← Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <div className="detail-back">
        <Link to="/" className="back-link">
          ← All KEPs
        </Link>
      </div>

      <div className="detail-header">
        <div className="detail-kep-number">KEP-{kep.number}</div>
        <h1 className="detail-title">{kep.title}</h1>
        <div className="detail-badges">
          <StatusBadge status={kep.status} />
          <StageBadge stage={kep.stage} />
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
                    @{a.replace(/^@/, '')}
                  </a>
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        {kep.milestone && Object.keys(kep.milestone).length > 0 && (
          <DetailSection title="Milestones">
            <div className="milestone-grid">
              {kep.milestone.alpha && (
                <MetaItem label="Alpha" value={kep.milestone.alpha} />
              )}
              {kep.milestone.beta && (
                <MetaItem label="Beta" value={kep.milestone.beta} />
              )}
              {kep.milestone.stable && (
                <MetaItem label="Stable" value={kep.milestone.stable} />
              )}
            </div>
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
                <li key={ref}>{ref}</li>
              ))}
            </ul>
          </DetailSection>
        )}

        {kep.replaces && kep.replaces.length > 0 && (
          <DetailSection title="Replaces">
            <ul className="see-also-list">
              {kep.replaces.map((ref) => (
                <li key={ref}>{ref}</li>
              ))}
            </ul>
          </DetailSection>
        )}

        {kep['superseded-by'] && kep['superseded-by'].length > 0 && (
          <DetailSection title="Superseded By">
            <ul className="see-also-list">
              {kep['superseded-by'].map((ref) => (
                <li key={ref}>{ref}</li>
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
    </div>
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
