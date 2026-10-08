// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickJump } from './QuickJump';
import { setCache } from '../api/shared';
import { CACHE_KEY_KEPS } from '../api/github';
import { CACHE_KEY_GEPS } from '../api/gatewayapi';

const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
}));

beforeEach(() => {
  nav.push.mockClear();
  setCache(CACHE_KEY_KEPS, [
    { number: '753', title: 'Sidecar Containers', sig: 'sig-node', slug: 'sidecar-containers', path: '', githubUrl: '' },
    { number: '2400', title: 'Node swap support', sig: 'sig-node', slug: 'swap', path: '', githubUrl: '' },
  ]);
  setCache(CACHE_KEY_GEPS, [{ number: 1709, name: 'Conformance profiles', path: '', githubUrl: '' }]);
});

describe('QuickJump', () => {
  it('opens with Ctrl+K and jumps to the first match with Enter', async () => {
    const user = userEvent.setup();
    render(<QuickJump />);

    await user.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox');
    expect(input).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Jump to a KEP or GEP' })).toBeInTheDocument();

    await user.type(input, '753');
    expect(screen.getByRole('option', { name: /KEP-753 Sidecar Containers/ })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    expect(nav.push).toHaveBeenCalledWith('/kep?number=753');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('searches titles across KEPs and GEPs and moves the selection with arrow keys', async () => {
    const user = userEvent.setup();
    render(<QuickJump />);
    await user.click(screen.getByRole('button', { name: 'Jump to a KEP or GEP' }));

    await user.type(screen.getByRole('combobox'), 'con');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['GEP-1709 Conformance profiles', 'KEP-753 Sidecar Containers']);

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', options[1].id);
    await user.keyboard('{Enter}');
    expect(nav.push).toHaveBeenCalledWith('/kep?number=753');
  });

  it('closes on Escape and returns focus to where it was', async () => {
    const user = userEvent.setup();
    render(<QuickJump />);
    const trigger = screen.getByRole('button', { name: 'Jump to a KEP or GEP' });
    await user.click(trigger);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(nav.push).not.toHaveBeenCalled();
  });
});
