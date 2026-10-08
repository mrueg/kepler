// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination, TabBar, TabPanel } from './Controls';

const TABS = [
  { id: 'list', label: 'List' },
  { id: 'release', label: 'Release' },
  { id: 'stats', label: 'Stats' },
] as const;

function Tabs() {
  const [active, setActive] = useState<(typeof TABS)[number]['id']>('list');
  return (
    <>
      <TabBar tabs={[...TABS]} active={active} onChange={setActive} idPrefix="t" label="Views" />
      <TabPanel idPrefix="t" active={active}>panel: {active}</TabPanel>
    </>
  );
}

describe('TabBar', () => {
  it('puts only the active tab in the Tab order and links it to the panel', () => {
    render(<Tabs />);
    const [list, release] = screen.getAllByRole('tab');
    expect(list).toHaveAttribute('aria-selected', 'true');
    expect(list).toHaveAttribute('tabindex', '0');
    expect(release).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel', { name: 'List' })).toHaveTextContent('panel: list');
  });

  it('moves between tabs with arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    render(<Tabs />);
    await user.tab();
    expect(screen.getByRole('tab', { name: 'List' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Release' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel: release');

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Stats' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'List' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Stats' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'List' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Pagination', () => {
  it('changes page and scrolls back to the top', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const onChange = vi.fn();
    render(<Pagination page={1} totalPages={3} onChange={onChange} />);

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onChange).toHaveBeenCalledWith(2);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
