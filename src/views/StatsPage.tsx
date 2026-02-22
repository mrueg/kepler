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

function KepStats() {
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
        </div>
      )}
    </>
  );
}

function GepStats() {
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
