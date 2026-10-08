// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckboxDropdown } from './SearchAndFilter';
import { NONE_SELECTED } from '../utils/selection';

const ITEMS = ['alpha', 'beta', 'stable'];

function Dropdown({ onChange }: { onChange?: (selected: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <CheckboxDropdown
        label="Stage"
        items={ITEMS}
        selected={selected}
        onChange={(next) => {
          setSelected(next);
          onChange?.(next);
        }}
      />
      <button>after</button>
    </>
  );
}

describe('CheckboxDropdown', () => {
  it('opens as a labelled group and moves focus into it', async () => {
    render(<Dropdown />);
    const toggle = screen.getByRole('button', { name: 'Stage' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const group = screen.getByRole('group', { name: 'Filter by Stage' });
    expect(toggle).toHaveAttribute('aria-controls', group.id);
    expect(screen.getByRole('button', { name: 'Select All' })).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the toggle', async () => {
    const user = userEvent.setup();
    render(<Dropdown />);
    await user.click(screen.getByRole('button', { name: 'Stage' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stage' })).toHaveFocus();
  });

  it('closes when focus moves past it', async () => {
    const user = userEvent.setup();
    render(<Dropdown />);
    await user.click(screen.getByRole('button', { name: 'Stage' }));

    // Select All → Deselect All → 3 checkboxes → the next control on the page.
    for (let i = 0; i < 5; i++) await user.tab();

    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('filters by the checked items and reports "none" after Deselect All', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Dropdown onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Stage' }));

    await user.click(screen.getByRole('checkbox', { name: 'beta' }));
    expect(onChange).toHaveBeenLastCalledWith(['alpha', 'stable']);
    expect(screen.getByRole('button', { name: 'Stage (2)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(onChange).toHaveBeenLastCalledWith([NONE_SELECTED]);
    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked();
  });
});
