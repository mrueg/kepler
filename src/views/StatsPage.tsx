'use client';

import { useMemo } from 'react';
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
import type { UseProposalsResult } from '../hooks/useProposals';
import { LoadStatus } from '../components/LoadingBar';
import type { Kep, KepStatus } from '../types/kep';
import type { Gep, GepStatus } from '../types/gep';
import { KEP_STATUS_COLORS, normalizeVersion, compareVersions } from '../utils/kep';
import { GEP_STATUS_COLORS, DEFAULT_STATUS_COLOR } from '../utils/gep';

const TOP_SIGS = 20;
const TOP_AUTHORS = 15;

const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
};

/** Counts occurrences of each key and returns them sorted by count, descending. */
function countBy<T>(items: T[], keysOf: (item: T) => (string | undefined)[]): { key: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const key of keysOf(item)) {
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

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
          <div key={version} className="heatmap-cell" title={`v${version}: ${count} KEP${count !== 1 ? 's' : ''} with milestone activity`}>
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

function StatusCharts({
  statusData,
  total,
  colorFor,
}: {
  statusData: { key: string; count: number }[];
  total: number;
  colorFor: (status: string) => string;
}) {
  return (
    <>
      <section className="stats-card">
        <h2 className="stats-card-title">Status Breakdown</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={statusData}
              dataKey="count"
              nameKey="key"
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
                <Cell key={entry.key} fill={colorFor(entry.key)} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [value ?? 0, name]} />
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
            {statusData.map(({ key, count }) => (
              <tr key={key}>
                <td>
                  <span className="stats-dot" style={{ background: colorFor(key) }} />
                  {key}
                </td>
                <td>{count}</td>
                <td>{total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function StageFunnel({
  title,
  data,
  noun,
  labelWidth,
}: {
  title: string;
  data: { stage: string; count: number; fill: string }[];
  noun: string;
  labelWidth: number;
}) {
  return (
    <section className="stats-card stats-card--wide">
      <h2 className="stats-card-title">{title}</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 60, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis
            type="category"
            dataKey="stage"
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
            width={labelWidth}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [value, noun]} />
          <Bar dataKey="count" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.stage} fill={entry.fill} />
            ))}
            <LabelList dataKey="count" position="right" style={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

/** Wide bar chart with angled category labels, used for SIG and author rankings. */
function RankingChart({ title, data }: { title: string; data: { key: string; count: number }[] }) {
  return (
    <section className="stats-card stats-card--wide">
      <h2 className="stats-card-title">{title}</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="key"
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            angle={-40}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

export function KepStats({ data }: { data: UseProposalsResult<Kep> }) {
  const { items: keps, loading, error } = data;

  const sigData = useMemo(() => countBy(keps, (k) => [k.sig]).slice(0, TOP_SIGS), [keps]);

  const yearData = useMemo(
    () =>
      countBy(keps, (k) => {
        const year = k['creation-date']?.slice(0, 4);
        return [year && /^\d{4}$/.test(year) ? year : undefined];
      })
        .map(({ key, count }) => ({ year: key, count }))
        .sort((a, b) => a.year.localeCompare(b.year)),
    [keps],
  );

  const statusData = useMemo(() => countBy(keps, (k) => [k.status ?? 'unknown']), [keps]);

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

  const authorData = useMemo(() => countBy(keps, (k) => k.authors ?? []).slice(0, TOP_AUTHORS), [keps]);

  const milestoneHeatmapData = useMemo(
    () =>
      // Each KEP counts once per release it had activity in; latest-milestone
      // usually repeats one of alpha/beta/stable and must not be counted twice.
      countBy(keps, (k) => [
        ...new Set(
          [k['latest-milestone'], k.milestone?.alpha, k.milestone?.beta, k.milestone?.stable].map(
            (v) => normalizeVersion(v) ?? undefined,
          ),
        ),
      ])
        .map(({ key, count }) => ({ version: key, count }))
        .sort((a, b) => compareVersions(a.version, b.version)),
    [keps],
  );

  return (
    <>
      <p className="stats-subtitle">
        A high-level view of {keps.length} Kubernetes Enhancement Proposals
      </p>

      <LoadStatus {...data} noun="KEPs" />

      {!loading && !error && (
        <div className="stats-grid">
          <RankingChart title={`KEP Distribution by SIG (Top ${TOP_SIGS})`} data={sigData} />

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
                <Tooltip contentStyle={TOOLTIP_STYLE} />
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

          <StatusCharts
            statusData={statusData}
            total={keps.length}
            colorFor={(s) => KEP_STATUS_COLORS[s as KepStatus] ?? DEFAULT_STATUS_COLOR}
          />

          {milestoneHeatmapData.length > 0 && (
            <section className="stats-card stats-card--wide">
              <h2 className="stats-card-title">Milestone Heatmap — KEP Activity per Kubernetes Release</h2>
              <MilestoneHeatmap data={milestoneHeatmapData} />
            </section>
          )}

          {keps.length > 0 && (
            <StageFunnel
              title="Stage Funnel — KEP Progression (alpha → beta → stable)"
              data={stageFunnelData}
              noun="KEPs"
              labelWidth={130}
            />
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
                    contentStyle={TOOLTIP_STYLE}
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
            <RankingChart title={`Top Authors (Top ${TOP_AUTHORS})`} data={authorData} />
          )}
        </div>
      )}
    </>
  );
}

export function GepStats({ data }: { data: UseProposalsResult<Gep> }) {
  const { items: geps, loading, error } = data;

  const statusData = useMemo(() => countBy(geps, (g) => [g.status ?? 'unknown']), [geps]);

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

  const authorData = useMemo(() => countBy(geps, (g) => g.authors ?? []).slice(0, TOP_AUTHORS), [geps]);

  return (
    <>
      <p className="stats-subtitle">
        A high-level view of {geps.length} Gateway API Enhancement Proposals
      </p>

      <LoadStatus {...data} noun="GEPs" />

      {!loading && !error && (
        <div className="stats-grid">
          <StatusCharts
            statusData={statusData}
            total={geps.length}
            colorFor={(s) => GEP_STATUS_COLORS[s as GepStatus] ?? DEFAULT_STATUS_COLOR}
          />

          {gepStageFunnelData.length > 0 && (
            <StageFunnel
              title="Stage Funnel — GEP Progression (Provisional → Experimental → Standard)"
              data={gepStageFunnelData}
              noun="GEPs"
              labelWidth={160}
            />
          )}

          {authorData.length > 0 && (
            <RankingChart title={`Top Authors (Top ${TOP_AUTHORS})`} data={authorData} />
          )}
        </div>
      )}
    </>
  );
}
