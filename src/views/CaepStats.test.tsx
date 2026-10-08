// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { CaepStats } from './StatsPage';
import { caepStatusColor } from '../components/Badges';
import type { Caep } from '../types/caep';

// jsdom has no layout, so give charts a fixed size.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div style={{ width: 800, height: 300 }}>{children}</div>,
  };
});

const caep = (id: string, overrides: Partial<Caep> = {}): Caep => ({
  id,
  title: id,
  date: `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`,
  archived: false,
  path: `docs/proposals/${id}.md`,
  githubUrl: '',
  githubDirUrl: '',
  ...overrides,
});

describe('CaepStats', () => {
  it('summarises CAEPs by status, year, authors and reviewers', () => {
    const items = [
      caep('20240916-a', { status: 'implementable', authors: ['@x'], reviewers: ['@r'] }),
      caep('20240101-b', { status: 'implemented', authors: ['@x', '@y'], reviewers: ['@r'] }),
      caep('20210222-c', { archived: true }),
    ];
    render(<CaepStats data={{ items, loading: false, progress: { loaded: 3, total: 3 }, error: null, reload: () => {} }} />);

    expect(screen.getByText('A high-level view of 3 Cluster API Enhancement Proposals (1 archived)')).toBeInTheDocument();
    for (const title of ['CAEPs Proposed per Year', 'Status Breakdown', 'Top Authors (Top 15)', 'Top Reviewers (Top 15)']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    // Status summary table, including proposals without a status.
    expect(screen.getByRole('cell', { name: 'unknown' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'implementable' })).toBeInTheDocument();
  });

  it('colours CAEP statuses like KEP statuses, plus experimental', () => {
    expect(caepStatusColor('implemented')).toBe('#10b981');
    expect(caepStatusColor('experimental')).toBe('#06b6d4');
    expect(caepStatusColor('unknown')).toBe('#8b949e');
  });
});
