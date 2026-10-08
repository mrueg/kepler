// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RateLimitHelp, TokenSettings } from './TokenSettings';
import { clearGitHubToken, getGitHubToken, setGitHubToken } from '../utils/githubToken';
import { json, stubFetch } from '../test/fetch';

afterEach(() => {
  clearGitHubToken();
});

describe('TokenSettings', () => {
  it('verifies and saves a pasted token', async () => {
    stubFetch((_url, init) =>
      new Headers(init?.headers).get('Authorization') === 'Bearer github_pat_good'
        ? json({ resources: { core: { limit: 5000, remaining: 5000, reset: 1_800_000_000 } } })
        : new Response('', { status: 401 }),
    );
    const user = userEvent.setup();
    render(<TokenSettings />);

    await user.click(screen.getByRole('button', { name: '🔑 Add GitHub token' }));
    const dialog = screen.getByRole('dialog', { name: 'GitHub token' });
    expect(dialog).toHaveTextContent('sent only to api.github.com');

    const input = screen.getByLabelText('Token');
    expect(input).toHaveAttribute('type', 'password');
    await user.type(input, 'github_pat_bad');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('GitHub rejected this token');
    expect(getGitHubToken()).toBeNull();

    await user.clear(input);
    await user.type(input, 'github_pat_good');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent('5,000 of 5,000 requests per hour');
    expect(getGitHubToken()).toBe('github_pat_good');
    expect(screen.getByRole('button', { name: '🔑 Using your GitHub token' })).toBeInTheDocument();
  });

  it('removes a saved token and closes with Escape', async () => {
    setGitHubToken('github_pat_saved');
    const user = userEvent.setup();
    render(<TokenSettings />);
    const trigger = screen.getByRole('button', { name: '🔑 Using your GitHub token' });

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Remove token' }));
    expect(getGitHubToken()).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('removed');
    expect(screen.getByLabelText('Token')).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('RateLimitHelp', () => {
  it('offers a token on rate-limit errors and opens the dialog', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TokenSettings />
        <RateLimitHelp error="GitHub API rate limit exceeded. Please try again later." />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Use a GitHub token' }));
    expect(screen.getByRole('dialog', { name: 'GitHub token' })).toBeInTheDocument();
  });

  it('stays hidden for other errors or when a token is set', () => {
    const { container, rerender } = render(<RateLimitHelp error="GitHub API error: 500" />);
    expect(container).toBeEmptyDOMElement();
    setGitHubToken('github_pat_x');
    rerender(<RateLimitHelp error="GitHub API rate limit exceeded." />);
    expect(container).toBeEmptyDOMElement();
  });
});
