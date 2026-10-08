'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { UseProposalsResult } from '../hooks/useProposals';
import { useUrlSync } from '../hooks/useUrlSync';
import { Badge, StageBadge } from '../components/Badges';
import { RateLimitHelp } from '../components/TokenSettings';
import {
  fetchReleaseMilestones,
  fetchTrackedEnhancements,
  pickCurrentMilestone,
  type ReleaseMilestone,
  type TrackedEnhancement,
  type TrackingStatus,
} from '../api/tracking';
import { formatSig } from '../utils/kep';
import type { Kep, KepStage } from '../types/kep';

const TRACKING: Record<TrackingStatus, { label: string; color: string; description: string }> = {
  tracked: { label: 'Tracked', color: '#10b981', description: 'Confirmed by the release team' },
  pending: { label: 'Pending', color: '#f59e0b', description: 'Opted in, not yet confirmed by the release team' },
  'not-tracked': { label: 'Not tracked', color: '#ef4444', description: 'Removed from the release' },
  'out-of-tree': { label: 'Out of tree', color: '#6b7280', description: 'Ships outside kubernetes/kubernetes' },
};
const TRACKING_ORDER: TrackingStatus[] = ['tracked', 'pending', 'out-of-tree', 'not-tracked'];
const KNOWN_STAGES = new Set(['pre-alpha', 'alpha', 'beta', 'stable']);

export interface SigGroup {
  sig: string;
  items: TrackedEnhancement[];
}

/**
 * Groups enhancements by owning SIG: the KEP's own SIG when the KEP is known,
 * else the first sig/* label on the issue. Largest groups first.
 */
export function groupBySig(items: TrackedEnhancement[], kepsByNumber: Map<string, Kep>): SigGroup[] {
  const groups = new Map<string, TrackedEnhancement[]>();
  for (const item of items) {
    const sig = kepsByNumber.get(item.number)?.sig ?? item.sigs[0] ?? 'unknown';
    groups.set(sig, [...(groups.get(sig) ?? []), item]);
  }
  return [...groups]
    .map(([sig, groupItems]) => ({ sig, items: groupItems.sort((a, b) => Number(a.number) - Number(b.number)) }))
    .sort((a, b) => b.items.length - a.items.length || a.sig.localeCompare(b.sig));
}

function StageCell({ stage }: { stage?: string }) {
  if (!stage) return <>—</>;
  if (KNOWN_STAGES.has(stage)) return <StageBadge stage={stage as KepStage} />;
  return <Badge text={stage} color="#6b7280" capitalize />;
}

/** What's opted in to a Kubernetes release, from the enhancement tracking issues. */
export function ReleaseTrackingPage({ data }: { data: UseProposalsResult<Kep> }) {
  const searchParams = useSearchParams();
  const [milestone, setMilestone] = useState<ReleaseMilestone | null>(null);
  const [trackingFilter, setTrackingFilter] = useState<TrackingStatus | ''>(() => {
    const t = searchParams.get('tracking');
    return t && t in TRACKING ? (t as TrackingStatus) : '';
  });
  const [items, setItems] = useState<TrackedEnhancement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const urlParams = new URLSearchParams({ tab: 'tracking' });
  if (trackingFilter) urlParams.set('tracking', trackingFilter);
  useUrlSync(urlParams, '/');

  useEffect(() => {
    let cancelled = false;
    fetchReleaseMilestones()
      .then((ms) => {
        if (cancelled) return;
        const current = pickCurrentMilestone(ms);
        if (current) setMilestone(current);
        else setError('No release milestone found.');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load milestones');
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    if (!milestone) return;
    let cancelled = false;
    fetchTrackedEnhancements(milestone)
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tracking issues');
      });
    return () => {
      cancelled = true;
    };
  }, [milestone, version]);

  const kepsByNumber = useMemo(() => new Map(data.items.map((k) => [k.number, k])), [data.items]);
  const visible = useMemo(
    () => (items ?? []).filter((i) => !trackingFilter || i.tracking === trackingFilter),
    [items, trackingFilter],
  );
  const groups = useMemo(() => groupBySig(visible, kepsByNumber), [visible, kepsByNumber]);

  const countBy = (fn: (i: TrackedEnhancement) => string | undefined) => {
    const counts = new Map<string, number>();
    for (const i of items ?? []) {
      const key = fn(i);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  };
  const stageCounts = countBy((i) => i.stage);
  const trackingCounts = countBy((i) => i.tracking);

  return (
    <div className="release-page">
      <h1 className="release-title">Release Tracking{milestone ? `: ${milestone.title}` : ''}</h1>
      <p className="release-subtitle">
        Enhancements opted in to the Kubernetes release in progress, from the{' '}
        <a href="https://github.com/kubernetes/enhancements/issues" target="_blank" rel="noopener noreferrer">
          enhancement tracking issues
        </a>
        . The release team clears these after each cycle, so for past releases see the Release Timeline tab, which is
        based on each KEP&apos;s own milestones.
      </p>

      <div className="release-controls">
        <label className="release-version-label" htmlFor="tracking-status-select">
          Status
        </label>
        <select
          id="tracking-status-select"
          className="release-version-select"
          value={trackingFilter}
          onChange={(e) => setTrackingFilter(e.target.value as TrackingStatus | '')}
        >
          <option value="">All</option>
          {TRACKING_ORDER.map((t) => (
            <option key={t} value={t}>
              {TRACKING[t].label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="error-box">
          <strong>Error loading release tracking:</strong> {error}
          <button
            className="retry-btn"
            onClick={() => {
              setError(null);
              setVersion((v) => v + 1);
            }}
          >
            Retry
          </button>
          <RateLimitHelp error={error} />
        </div>
      )}

      {!error && !items && (
        <div className="detail-loading">
          <div className="spinner" />
          <p>Loading tracking issues…</p>
        </div>
      )}

      {items && (
        <>
          <div className="tracking-summary" aria-label="Summary">
            <span className="tracking-summary-total">
              {items.length} enhancement{items.length !== 1 ? 's' : ''} opted in to {milestone?.title}
            </span>
            {['alpha', 'beta', 'stable'].map((stage) =>
              stageCounts.get(stage) ? (
                <span key={stage}>
                  <StageCell stage={stage} /> {stageCounts.get(stage)}
                </span>
              ) : null,
            )}
            {TRACKING_ORDER.map((t) =>
              trackingCounts.get(t) ? (
                <span key={t} title={TRACKING[t].description}>
                  <Badge text={TRACKING[t].label} color={TRACKING[t].color} /> {trackingCounts.get(t)}
                </span>
              ) : null,
            )}
          </div>

          {groups.length === 0 && <p className="release-empty">No enhancements match.</p>}

          {groups.map(({ sig, items: sigItems }) => (
            <section key={sig} className="release-group">
              <div className="release-group-header">
                <h2 className="release-group-title tracking-sig-title">{formatSig(sig)}</h2>
                <span className="release-group-count">{sigItems.length}</span>
              </div>
              <div className="kep-table-wrapper">
                <table className="kep-table">
                  <thead>
                    <tr>
                      <th className="kep-table-th kep-table-th-number">KEP</th>
                      <th className="kep-table-th kep-table-th-title">Title</th>
                      <th className="kep-table-th kep-table-th-stage">Stage</th>
                      <th className="kep-table-th kep-table-th-status">Tracking</th>
                      <th className="kep-table-th">Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sigItems.map((item) => {
                      const tracking = TRACKING[item.tracking];
                      return (
                        <tr key={item.number} className="kep-table-row">
                          <td className="kep-table-td kep-table-td-number">
                            {kepsByNumber.has(item.number) ? (
                              <Link href={`/kep?number=${item.number}`} className="kep-table-number-link">
                                KEP-{item.number}
                              </Link>
                            ) : (
                              <>KEP-{item.number}</>
                            )}
                          </td>
                          <td className="kep-table-td kep-table-td-title">{item.title}</td>
                          <td className="kep-table-td kep-table-td-stage">
                            <StageCell stage={item.stage} />
                          </td>
                          <td className="kep-table-td kep-table-td-status" title={tracking.description}>
                            <Badge text={tracking.label} color={tracking.color} />
                          </td>
                          <td className="kep-table-td">
                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                              #{item.number}
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
