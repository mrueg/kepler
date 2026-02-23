'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { useKeps } from '../hooks/useKeps';
import { useGeps } from '../hooks/useGeps';
import { LoadingBar } from '../components/LoadingBar';
import type { KepStatus } from '../types/kep';
import type { GepStatus } from '../types/gep';

const STATUS_COLORS: Record<KepStatus, string> = {
  provisional: '#e2a03f',
  implementable: '#326ce5',
  implemented: '#2ea043',
  deferred: '#8b949e',
  rejected: '#cf222e',
  withdrawn: '#9a6700',
  replaced: '#6e40c9',
};

const GEP_STATUS_COLORS: Record<GepStatus, string> = {
  Memorandum: '#6e40c9',
  Provisional: '#e2a03f',
  Experimental: '#326ce5',
  Standard: '#2ea043',
  Declined: '#cf222e',
  Deferred: '#8b949e',
  Withdrawn: '#9a6700',
};

const TOP_SIGS = 20;
const TOP_AUTHORS = 15;

interface HeatmapCell {
  version: string;
  count: number;
}

function MilestoneHeatmap({ data }: { data: HeatmapCell[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="milestone-heatmap">
      {data.map(({ version, count }) => {
        const intensity = count / maxCount;
        return (
          <div key={version} className="heatmap-cell" title={`v${version}: ${count} KEP milestone event${count !== 1 ? 's' : ''}`}>
            <div
              className="heatmap-cell-block"
              style={{ opacity: 0.15 + intensity * 0.85 }}
            />
            <span className="heatmap-cell-label">v{version}</span>
            <span className="heatmap-cell-count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export function KepStats() {
  const { keps, loading, progress, error, reload } = useKeps();

  const sigData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const kep of keps) {
      if (kep.sig) counts[kep.sig] = (counts[kep.sig] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([sig, count]) => ({ sig, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_SIGS);
  }, [keps]);

  const yearData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const kep of keps) {
      const date = kep['creation-date'];
      if (date) {
        const year = date.slice(0, 4);
        if (/^\d{4}$/.test(year)) {
          counts[year] = (counts[year] ?? 0) + 1;
        }
      }
    }
    return Object.entries(counts)
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [keps]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const kep of keps) {
      const s = kep.status ?? 'unknown';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [keps]);

  const stageFunnelData = useMemo(() => {
    const withAlpha = keps.filter((k) => k.milestone?.alpha).length;
    const withBeta = keps.filter((k) => k.milestone?.beta).length;
    const withStable = keps.filter((k) => k.milestone?.stable).length;
    return [
      { stage: 'All KEPs', count: keps.length, fill: '#8b949e' },
      { stage: 'Reached Alpha', count: withAlpha, fill: '#e2a03f' },
      { stage: 'Reached Beta', count: withBeta, fill: '#326ce5' },
      { stage: 'Reached Stable', count: withStable, fill: '#2ea043' },
    ];
  }, [keps]);

  const timeToStableData = useMemo(() => {
    function parseKubeMinor(v: string | undefined): number | null {
      if (!v) return null;
      const match = v.replace(/^v/, '').match(/^1\.(\d+)/);
      return match ? parseInt(match[1]) : null;
    }
    const counts: Record<number, number> = {};
    for (const kep of keps) {
      const alpha = parseKubeMinor(kep.milestone?.alpha);
      const stable = parseKubeMinor(kep.milestone?.stable);
      if (alpha !== null && stable !== null && stable >= alpha) {
        const diff = stable - alpha;
        counts[diff] = (counts[diff] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([releases, count]) => ({ releases: Number(releases), count }))
      .sort((a, b) => a.releases - b.releases);
  }, [keps]);

  const authorData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const kep of keps) {
      for (const author of kep.authors ?? []) {
        counts[author] = (counts[author] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_AUTHORS);
  }, [keps]);

  const milestoneHeatmapData = useMemo(() => {
    const counts: Record<string, number> = {};
    function addVersion(v: string | undefined) {
      if (!v) return;
      const match = v.replace(/^v/, '').match(/^(\d+\.\d+)/);
      if (match) {
        const ver = match[1];
        counts[ver] = (counts[ver] ?? 0) + 1;
      }
    }
    for (const kep of keps) {
      addVersion(kep['latest-milestone']);
      addVersion(kep.milestone?.alpha);
      addVersion(kep.milestone?.beta);
      addVersion(kep.milestone?.stable);
    }
    return Object.entries(counts)
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => {
        const [aMaj, aMin] = a.version.split('.').map(Number);
        const [bMaj, bMin] = b.version.split('.').map(Number);
        return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
      });
  }, [keps]);

  return (
    <>
      <p className="stats-subtitle">
        A high-level view of {keps.length} Kubernetes Enhancement Proposals
      </p>

      {loading && <LoadingBar loaded={progress.loaded} total={progress.total} />}

      {error && (
        <div className="error-box">
          <strong>Error loading KEPs:</strong> {error}
          <button className="retry-btn" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="stats-grid">
          <section className="stats-card stats-card--wide">
            <h2 className="stats-card-title">
              KEP Distribution by SIG (Top {TOP_SIGS})
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={sigData}
                margin={{ top: 8, right: 16, left: 0, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="sig"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="stats-card stats-card--wide">
            <h2 className="stats-card-title">KEPs Created per Year</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={yearData}
                margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--accent)', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="stats-card">
            <h2 className="stats-card-title">Status Breakdown</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="45%"
                  outerRadius={100}
                  label={({ name, percent }) =>
                    percent && percent > 0.04
                      ? `${name} (${(percent * 100).toFixed(0)}%)`
                      : ''
                  }
                  labelLine={false}
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={
                        STATUS_COLORS[entry.status as KepStatus] ?? '#8b949e'
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  formatter={(value, name) => [value ?? 0, name]}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: 'var(--text)', fontSize: 12 }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </section>

          <section className="stats-card">
            <h2 className="stats-card-title">Status Summary</h2>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {statusData.map(({ status, count }) => (
                  <tr key={status}>
                    <td>
                      <span
                        className="stats-dot"
                        style={{
                          background:
                            STATUS_COLORS[status as KepStatus] ?? '#8b949e',
                        }}
                      />
                      {status}
                    </td>
                    <td>{count}</td>
                    <td>{keps.length > 0 ? ((count / keps.length) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {milestoneHeatmapData.length > 0 && (
            <section className="stats-card stats-card--wide">
              <h2 className="stats-card-title">Milestone Heatmap — KEP Activity per Kubernetes Release</h2>
              <MilestoneHeatmap data={milestoneHeatmapData} />
            </section>
          )}

          {stageFunnelData[0].count > 0 && (
            <section className="stats-card stats-card--wide">
              <h2 className="stats-card-title">Stage Funnel — KEP Progression (alpha → beta → stable)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={stageFunnelData}
                  layout="vertical"
                  margin={{ top: 8, right: 60, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                    width={130}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                    formatter={(value) => [value, 'KEPs']}
                  />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {stageFunnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="count" position="right" style={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {timeToStableData.length > 0 && (
            <section className="stats-card stats-card--wide">
              <h2 className="stats-card-title">Time-to-Stable Histogram — Releases from Alpha to Stable</h2>
              <p className="stats-chart-note">Kubernetes releases ~3× per year; each release ≈ 4 months. Only KEPs with both alpha and stable milestones are included.</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={timeToStableData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="releases"
                    tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                    label={{ value: 'Kubernetes releases', position: 'insideBottom', offset: -2, fill: 'var(--text-secondary)', fontSize: 12 }}
                    height={40}
                  />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                    formatter={(value, _name, props) => [
                      value,
                      `KEPs (${props.payload.releases} release${props.payload.releases !== 1 ? 's' : ''})`,
                    ]}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {authorData.length > 0 && (
            <section className="stats-card stats-card--wide">
              <h2 className="stats-card-title">
                Top Authors (Top {TOP_AUTHORS})
              </h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={authorData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="author"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </div>
      )}
    </>
  );
}

export function GepStats() {
  const { geps, loading, progress, error, reload } = useGeps();

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const gep of geps) {
      const s = gep.status ?? 'unknown';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [geps]);

  const gepStageFunnelData = useMemo(() => {
    const provisional = geps.filter((g) =>
      ['Provisional', 'Experimental', 'Standard'].includes(g.status)
    ).length;
    const experimental = geps.filter((g) =>
      ['Experimental', 'Standard'].includes(g.status)
    ).length;
    const standard = geps.filter((g) => g.status === 'Standard').length;
    if (provisional === 0) return [];
    return [
      { stage: 'All GEPs', count: geps.length, fill: '#8b949e' },
      { stage: 'Reached Provisional', count: provisional, fill: '#e2a03f' },
      { stage: 'Reached Experimental', count: experimental, fill: '#326ce5' },
      { stage: 'Reached Standard', count: standard, fill: '#2ea043' },
    ];
  }, [geps]);

  const authorData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const gep of geps) {
      for (const author of gep.authors ?? []) {
        counts[author] = (counts[author] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_AUTHORS);
  }, [geps]);

  return (
    <>
      <p className="stats-subtitle">
        A high-level view of {geps.length} Gateway API Enhancement Proposals
      </p>

      {loading && <LoadingBar loaded={progress.loaded} total={progress.total} />}

      {error && (
        <div className="error-box">
          <strong>Error loading GEPs:</strong> {error}
          <button className="retry-btn" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="stats-grid">
          <section className="stats-card">
            <h2 className="stats-card-title">Status Breakdown</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="45%"
                  outerRadius={100}
                  label={({ name, percent }) =>
                    percent && percent > 0.04
                      ? `${name} (${(percent * 100).toFixed(0)}%)`
                      : ''
                  }
                  labelLine={false}
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={
                        GEP_STATUS_COLORS[entry.status as GepStatus] ?? '#8b949e'
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  formatter={(value, name) => [value ?? 0, name]}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: 'var(--text)', fontSize: 12 }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </section>

          <section className="stats-card">
            <h2 className="stats-card-title">Status Summary</h2>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {statusData.map(({ status, count }) => (
                  <tr key={status}>
                    <td>
                      <span
                        className="stats-dot"
                        style={{
                          background:
                            GEP_STATUS_COLORS[status as GepStatus] ?? '#8b949e',
                        }}
                      />
                      {status}
                    </td>
                    <td>{count}</td>
                    <td>{geps.length > 0 ? ((count / geps.length) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {gepStageFunnelData.length > 0 && (
            <section className="stats-card stats-card--wide">
              <h2 className="stats-card-title">Stage Funnel — GEP Progression (Provisional → Experimental → Standard)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={gepStageFunnelData}
                  layout="vertical"
                  margin={{ top: 8, right: 60, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                    width={160}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                    formatter={(value) => [value, 'GEPs']}
                  />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {gepStageFunnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="count" position="right" style={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {authorData.length > 0 && (
            <section className="stats-card stats-card--wide">
              <h2 className="stats-card-title">
                Top Authors (Top {TOP_AUTHORS})
              </h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={authorData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="author"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </div>
      )}
    </>
  );
}

export function StatsPage() {
  const [activeTab, setActiveTab] = useState<'keps' | 'geps'>('keps');

  return (
    <div className="stats-page">
      <h1 className="stats-title">Analytics Dashboard</h1>

      <div className="stats-tabs" role="tablist">
        <button
          className={`stats-tab${activeTab === 'keps' ? ' stats-tab--active' : ''}`}
          onClick={() => setActiveTab('keps')}
          aria-selected={activeTab === 'keps'}
          role="tab"
          tabIndex={activeTab === 'keps' ? 0 : -1}
        >
          KEPs
        </button>
        <button
          className={`stats-tab${activeTab === 'geps' ? ' stats-tab--active' : ''}`}
          onClick={() => setActiveTab('geps')}
          aria-selected={activeTab === 'geps'}
          role="tab"
          tabIndex={activeTab === 'geps' ? 0 : -1}
        >
          GEPs
        </button>
      </div>

      {activeTab === 'keps' ? <KepStats /> : <GepStats />}
    </div>
  );
}
