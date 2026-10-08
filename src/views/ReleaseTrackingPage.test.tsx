// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { AnchorHTMLAttributes } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReleaseTrackingPage, groupBySig } from './ReleaseTrackingPage';
import { json, stubFetch } from '../test/fetch';
import type { Kep } from '../types/kep';
import type { TrackedEnhancement } from '../api/tracking';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const kep = (number: string, sig: string): Kep => ({
  path: `keps/${sig}/${number}-x/kep.yaml`,
  number,
  sig,
  slug: 'x',
  githubUrl: '',
});

const item = (number: string, sigs: string[], tracking: TrackedEnhancement['tracking'] = 'tracked'): TrackedEnhancement => ({
  number,
  title: `Enhancement ${number}`,
  stage: 'alpha',
  tracking,
  sigs,
  state: 'open',
  url: `https://github.com/kubernetes/enhancements/issues/${number}`,
});

describe('groupBySig', () => {
  it('uses the KEP owning SIG when known, else the first sig label, largest groups first', () => {
    const groups = groupBySig(
      [item('3', ['sig-apps', 'sig-node']), item('2', ['sig-node']), item('1', []), item('4', ['sig-apps'])],
      new Map([['3', kep('3', 'sig-node')]]),
    );
    expect(groups.map((g) => [g.sig, g.items.map((i) => i.number)])).toEqual([
      ['sig-node', ['2', '3']],
      ['sig-apps', ['4']],
      ['unknown', ['1']],
    ]);
  });
});

function stubGitHub() {
  const labels = (sig: string, tracked: string) => [`sig/${sig}`, 'stage/beta', tracked, 'lead-opted-in'].map((name) => ({ name }));
  return stubFetch((url) => {
    if (url.includes('/milestones')) {
      return json([
        { number: 37, title: 'v1.37', open_issues: 9, closed_issues: 161 },
        { number: 38, title: 'v1.38', open_issues: 89, closed_issues: 125 },
      ]);
    }
    if (url.includes('milestone=38')) {
      return json([
        { number: 753, title: 'Sidecar', state: 'open', html_url: 'u753', labels: labels('node', 'tracked/yes') },
        { number: 900, title: 'Pending one', state: 'open', html_url: 'u900', labels: labels('apps', 'lead-opted-in') },
      ]);
    }
    return undefined;
  });
}

const data = { items: [kep('753', 'sig-node')], loading: false, progress: { loaded: 1, total: 1 }, error: null, reload: () => {} };

describe('ReleaseTrackingPage', () => {
  it('shows the current release grouped by SIG, linking known KEPs', async () => {
    nav.search = 'tab=tracking';
    stubGitHub();
    render(<ReleaseTrackingPage data={data} />);

    expect(await screen.findByText('2 enhancements opted in to v1.38')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Release Tracking: v1.38');
    expect(screen.getByRole('heading', { name: 'SIG node' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'KEP-753' })).toHaveAttribute('href', '/kep?number=753');
    // Not in the loaded KEP list: no internal link, but the issue link remains.
    expect(screen.queryByRole('link', { name: 'KEP-900' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '#900' })).toHaveAttribute('href', 'u900');
  });

  it('filters by tracking status', async () => {
    nav.search = 'tab=tracking';
    stubGitHub();
    const user = userEvent.setup();
    render(<ReleaseTrackingPage data={data} />);
    await screen.findByText('2 enhancements opted in to v1.38');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'pending');
    const rows = screen.getAllByRole('row').filter((r) => within(r).queryAllByRole('cell').length > 0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Pending one');
  });

});
