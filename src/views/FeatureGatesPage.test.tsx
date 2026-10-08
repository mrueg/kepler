// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { AnchorHTMLAttributes } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeatureGatesPage } from './FeatureGatesPage';
import type { Kep } from '../types/kep';

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

function kep(number: string, title: string, overrides: Partial<Kep>): Kep {
  return {
    path: `keps/sig-node/${number}-x/kep.yaml`,
    number,
    title,
    sig: 'sig-node',
    slug: 'x',
    githubUrl: '',
    ...overrides,
  };
}

const data = {
  items: [
    kep('753', 'Sidecar Containers', {
      stage: 'stable',
      'disable-supported': false,
      'feature-gates': [{ name: 'SidecarContainers', components: ['kubelet', 'kube-apiserver'] }],
    }),
    kep('2400', 'Node swap', { 'feature-gates': [{ name: 'NodeSwap', components: ['kubelet'] }] }),
    kep('1', 'No gates', {}),
  ],
  loading: false,
  progress: { loaded: 3, total: 3 },
  error: null,
  reload: () => {},
};

function gateRows() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1);
}

describe('FeatureGatesPage', () => {
  it('lists every gate with its KEP, components and whether it can be disabled', () => {
    nav.search = '';
    render(<FeatureGatesPage data={data} />);

    expect(gateRows()).toHaveLength(2);
    const sidecar = gateRows()[1];
    expect(sidecar).toHaveTextContent('SidecarContainers');
    expect(within(sidecar).getByRole('link')).toHaveAttribute('href', '/kep?number=753');
    expect(sidecar).toHaveTextContent('kubelet, kube-apiserver');
    expect(sidecar).toHaveTextContent('No');
  });

  it('filters by gate name or component, starting from the URL', async () => {
    nav.search = 'tab=gates&gate=sidecar';
    render(<FeatureGatesPage data={data} />);
    expect(gateRows()).toHaveLength(1);

    const search = screen.getByRole('searchbox', { name: 'Search feature gates' });
    await userEvent.clear(search);
    await userEvent.type(search, 'kubelet');
    expect(gateRows()).toHaveLength(2);

    await userEvent.clear(search);
    await userEvent.type(search, 'nodeswap');
    expect(gateRows()).toHaveLength(1);
    expect(gateRows()[0]).toHaveTextContent('NodeSwap');
  });
});
