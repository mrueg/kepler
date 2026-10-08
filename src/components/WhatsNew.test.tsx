// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import { WhatsNew } from './WhatsNew';
import type { Caep } from '../types/caep';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const caep = (id: string, title: string): Caep => ({
  id,
  title,
  date: `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`,
  status: 'implementable',
  archived: false,
  path: `docs/proposals/${id}.md`,
  githubUrl: '',
  githubDirUrl: '',
});

describe('WhatsNew for CAEPs', () => {
  it('lists recently changed CAEPs by id, skipping unknown ones', () => {
    render(
      <WhatsNew
        caeps={[caep('20240916-improve-status', 'Improving status'), caep('20200506-conditions', 'Conditions')]}
        recentCaepChanges={[
          { number: '20240916-improve-status', date: new Date() },
          { number: '20990101-not-loaded', date: new Date() },
          { number: '20200506-conditions', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        ]}
      />,
    );

    expect(screen.getByText('Recently changed CAEPs')).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/caep?id=20240916-improve-status',
      '/caep?id=20200506-conditions',
    ]);
    expect(screen.getByText('today')).toBeInTheDocument();
    expect(screen.getByText('3d ago')).toBeInTheDocument();
    expect(screen.queryByText('Recently changed KEPs')).not.toBeInTheDocument();
  });
});
