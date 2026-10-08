// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import { CaepDetailPage } from './CaepDetailPage';
import { setCache } from '../api/shared';
import { CACHE_KEY_CAEPS } from '../api/clusterapi';
import { stubFetch } from '../test/fetch';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('CaepDetailPage', () => {
  it('renders metadata, links references to other CAEPs, and renders the proposal body', async () => {
    setCache(CACHE_KEY_CAEPS, [
      { id: '20240916-improve-status', path: 'docs/proposals/20240916-improve-status.md', title: 'Improving status' },
      { id: '20200506-conditions', path: 'docs/proposals/20200506-conditions.md', title: 'Conditions' },
    ]);
    stubFetch((url) =>
      url.endsWith('/docs/proposals/20240916-improve-status.md')
        ? new Response(
            '---\ntitle: Improving status\nauthors:\n- "@fabriziopandini"\nstatus: implementable\nsee-also:\n- "https://github.com/kubernetes-sigs/cluster-api/blob/main/docs/proposals/20200506-conditions.md"\n- "https://example.com/doc"\n---\n## Summary\n\nSee [the image](images/a.png).\n',
          )
        : undefined,
    );

    render(<CaepDetailPage id="20240916-improve-status" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Improving status' })).toBeInTheDocument();
    expect(screen.getByText('CAEP · 2024-09-16')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Conditions' })).toHaveAttribute('href', '/caep?id=20200506-conditions');
    expect(screen.getByRole('link', { name: 'https://example.com/doc' })).toHaveAttribute('href', 'https://example.com/doc');
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    // Relative links in the body resolve against the proposals folder on GitHub.
    expect(screen.getByRole('link', { name: 'the image' })).toHaveAttribute(
      'href',
      'https://github.com/kubernetes-sigs/cluster-api/blob/main/docs/proposals/images/a.png',
    );
  });

  it('shows an error for unknown ids', async () => {
    stubFetch((url) => (url.includes('/git/trees/') ? new Response(JSON.stringify({ tree: [] })) : undefined));
    render(<CaepDetailPage id="20990101-nope" />);
    expect(await screen.findByText('CAEP not found.')).toBeInTheDocument();
  });
});
