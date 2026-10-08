import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchReleaseMilestones, fetchTrackedEnhancements, pickCurrentMilestone, toTrackedEnhancement } from './tracking';
import { json, stubFetch } from '../test/fetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

const issue = (number: number, labels: string[], extra: object = {}) => ({
  number,
  title: ` Issue ${number} `,
  state: 'open',
  html_url: `https://github.com/kubernetes/enhancements/issues/${number}`,
  labels: labels.map((name) => ({ name })),
  ...extra,
});

describe('fetchReleaseMilestones', () => {
  it('keeps release milestones with issues, newest first', async () => {
    stubFetch((url) =>
      url.includes('/milestones')
        ? json([
            { number: 1, title: 'v1.9', open_issues: 0, closed_issues: 50 },
            { number: 2, title: 'v1.38', open_issues: 89, closed_issues: 125 },
            { number: 3, title: 'v1.40', open_issues: 0, closed_issues: 0 },
            { number: 4, title: 'triage', open_issues: 5, closed_issues: 0 },
            { number: 5, title: 'v1.39', open_issues: 1, closed_issues: 0 },
          ])
        : undefined,
    );
    expect((await fetchReleaseMilestones()).map((m) => m.title)).toEqual(['v1.39', 'v1.38', 'v1.9']);
  });

  it('reports rate limiting clearly', async () => {
    stubFetch(() => new Response('', { status: 403 }));
    await expect(fetchReleaseMilestones()).rejects.toThrow(/rate limit/);
  });
});

describe('pickCurrentMilestone', () => {
  const m = (title: string, openIssues: number) => ({ number: 0, title, openIssues, closedIssues: 0 });

  it('picks the milestone with the most open issues, preferring newer on ties', () => {
    expect(pickCurrentMilestone([m('v1.39', 1), m('v1.38', 89), m('v1.37', 9)])?.title).toBe('v1.38');
    expect(pickCurrentMilestone([m('v1.37', 3), m('v1.38', 3)])?.title).toBe('v1.38');
    expect(pickCurrentMilestone([])).toBeUndefined();
  });
});

describe('toTrackedEnhancement', () => {
  it('reads stage, tracking status and SIGs from labels', () => {
    expect(toTrackedEnhancement(issue(6406, ['sig/scheduling', 'stage/alpha', 'tracked/yes', 'lead-opted-in', 'wg/device-management']))).toEqual({
      number: '6406',
      title: 'Issue 6406',
      stage: 'alpha',
      tracking: 'tracked',
      sigs: ['sig-scheduling'],
      state: 'open',
      url: 'https://github.com/kubernetes/enhancements/issues/6406',
    });
    expect(toTrackedEnhancement(issue(1, ['lead-opted-in'])).tracking).toBe('pending');
    expect(toTrackedEnhancement(issue(1, ['tracked/no'])).tracking).toBe('not-tracked');
    expect(toTrackedEnhancement(issue(1, ['tracked/out-of-tree'])).tracking).toBe('out-of-tree');
  });
});

describe('fetchTrackedEnhancements', () => {
  const milestone = { number: 7, title: 'v1.38', openIssues: 1, closedIssues: 0 };

  it('queries opted-in issues, skips pull requests, follows pages and caches', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => issue(i + 1, ['lead-opted-in']));
    const page2 = [issue(101, ['lead-opted-in']), issue(102, ['lead-opted-in'], { pull_request: {} })];
    const fetchMock = stubFetch((url) => {
      if (!url.includes('milestone=7&labels=lead-opted-in&state=all')) return undefined;
      return json(/[?&]page=1(&|$)/.test(url) ? page1 : page2);
    });

    const items = await fetchTrackedEnhancements(milestone);
    expect(items).toHaveLength(101);
    expect(items.some((i) => i.number === '102')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await fetchTrackedEnhancements(milestone);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
