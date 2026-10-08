// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnchorHTMLAttributes } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KepListPage } from './KepListPage';
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

function kep(number: string, title: string): Kep {
  return {
    path: `keps/sig-node/${number}-x/kep.yaml`,
    number,
    title,
    sig: 'sig-node',
    slug: 'x',
    status: 'implementable',
    githubUrl: `https://github.com/kubernetes/enhancements/tree/master/keps/sig-node/${number}-x`,
  };
}

const data = {
  items: [kep('1', 'Bravo'), kep('2', 'Alpha'), kep('3', 'Charlie')],
  loading: false,
  progress: { loaded: 3, total: 3 },
  error: null,
  reload: () => {},
};

function rowTitles(): string[] {
  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
  return rows.map((row) => within(row).getAllByRole('link')[1].textContent ?? '');
}

beforeEach(() => {
  nav.search = '';
  nav.replace.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('KepListPage URL state', () => {
  it('restores view mode, sort order and the bookmarked filter from the URL', () => {
    localStorage.setItem('kepler_bookmarks_v1', JSON.stringify(['1', '3']));
    nav.search = 'view=table&sort=title&dir=desc&bookmarked=true';

    render(<KepListPage data={data} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(rowTitles()).toEqual(['Charlie', 'Bravo']);
    expect(screen.getByRole('button', { name: /bookmarks/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes display changes back to the URL, debounced', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<KepListPage data={data} />);

    await user.click(screen.getByRole('button', { name: 'Table view' }));
    await user.click(screen.getByRole('columnheader', { name: /title/i }));
    await user.click(screen.getByRole('columnheader', { name: /title/i }));
    expect(rowTitles()).toEqual(['Charlie', 'Bravo', 'Alpha']);

    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(nav.replace).toHaveBeenLastCalledWith('?view=table&sort=title&dir=desc', { scroll: false });
  });
});
