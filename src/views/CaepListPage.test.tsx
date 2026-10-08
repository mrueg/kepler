// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaepListPage } from './CaepListPage';
import type { Caep } from '../types/caep';

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

function caep(id: string, title: string, overrides: Partial<Caep> = {}): Caep {
  return {
    id,
    title,
    date: `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`,
    archived: false,
    path: `docs/proposals/${id}.md`,
    githubUrl: '',
    githubDirUrl: '',
    ...overrides,
  };
}

const data = {
  items: [
    caep('20240916-improve-status', 'Improving status in CAPI resources', { status: 'implementable', authors: ['@fabriziopandini'] }),
    caep('20210222-kubelet-authentication', 'Cluster API Kubelet Authentication', { status: 'implementable', archived: true }),
    caep('20181121-machine-api', 'Minimalistic Machines API'),
  ],
  loading: false,
  progress: { loaded: 3, total: 3 },
  error: null,
  reload: () => {},
};

describe('CaepListPage', () => {
  it('lists proposals with date, status and archived marker, linking by id', () => {
    nav.search = '';
    render(<CaepListPage data={data} />);

    expect(screen.getByText('3 CAEPs')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Improving status in CAPI resources' })).toHaveAttribute(
      'href',
      '/caep?id=20240916-improve-status',
    );
    expect(screen.getByText('CAEP · 2018-11-21')).toBeInTheDocument();
    expect(screen.getAllByText('Archived')).toHaveLength(1);
  });

  it('searches by author and filters proposals without a status as "unknown"', async () => {
    nav.search = 'status=unknown';
    render(<CaepListPage data={data} />);
    expect(screen.getByText('1 CAEP matching filters')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Minimalistic Machines API' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search CAEPs' }), 'fabrizio');
    expect(screen.getByText('1 CAEP matching filters')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Improving status in CAPI resources' })).toBeInTheDocument();
  });
});
