import { githubFetch } from '../utils/githubFetch';
import { GITHUB_API_BASE, getCached, readCache, setCache } from './shared';
import { compareVersions } from '../utils/kep';

const REPO = 'kubernetes/enhancements';
const CACHE_KEY_MILESTONES = 'kepler_release_milestones_v1';
const CACHE_KEY_TRACKING = 'kepler_release_tracking_v1';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const PAGE_SIZE = 100;
const MAX_PAGES = 3;

export interface ReleaseMilestone {
  /** GitHub milestone number, used in API queries. */
  number: number;
  /** e.g. "v1.38" */
  title: string;
  openIssues: number;
  closedIssues: number;
}

export type TrackingStatus = 'tracked' | 'pending' | 'not-tracked' | 'out-of-tree';

export interface TrackedEnhancement {
  /** The tracking issue number, which is also the KEP number. */
  number: string;
  title: string;
  /** From the stage/* label, e.g. "alpha". */
  stage?: string;
  tracking: TrackingStatus;
  /** From the sig/* labels, e.g. "sig-node". */
  sigs: string[];
  state: 'open' | 'closed';
  url: string;
}

interface GitHubLabel {
  name: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  labels: GitHubLabel[];
  milestone?: { number: number } | null;
  pull_request?: unknown;
}

/** Release milestones (v1.N) that have any issues, newest first. */
export async function fetchReleaseMilestones(): Promise<ReleaseMilestone[]> {
  const cached = getCached<ReleaseMilestone[]>(CACHE_KEY_MILESTONES, CACHE_TTL);
  if (cached) return cached;

  const resp = await githubFetch(`${GITHUB_API_BASE}/repos/${REPO}/milestones?state=all&per_page=100`);
  if (resp.status === 403 || resp.status === 429)
    throw new Error('GitHub API rate limit exceeded. Please try again later.');
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);

  const milestones = ((await resp.json()) as Array<{
    number: number;
    title: string;
    open_issues: number;
    closed_issues: number;
  }>)
    .filter((m) => /^v\d+\.\d+$/.test(m.title) && m.open_issues + m.closed_issues > 0)
    .map((m) => ({ number: m.number, title: m.title, openIssues: m.open_issues, closedIssues: m.closed_issues }))
    .sort((a, b) => compareVersions(b.title, a.title));

  setCache(CACHE_KEY_MILESTONES, milestones);
  return milestones;
}

/**
 * The release currently being worked on. Milestones have no due dates, so this
 * is the one with the most open tracking issues (ties go to the newer release).
 */
export function pickCurrentMilestone(milestones: ReleaseMilestone[]): ReleaseMilestone | undefined {
  return milestones.reduce<ReleaseMilestone | undefined>(
    (best, m) =>
      !best || m.openIssues > best.openIssues ||
      (m.openIssues === best.openIssues && compareVersions(m.title, best.title) > 0)
        ? m
        : best,
    undefined,
  );
}

function trackingStatus(labels: string[]): TrackingStatus {
  if (labels.includes('tracked/yes')) return 'tracked';
  if (labels.includes('tracked/no')) return 'not-tracked';
  if (labels.includes('tracked/out-of-tree')) return 'out-of-tree';
  return 'pending';
}

export function toTrackedEnhancement(issue: GitHubIssue): TrackedEnhancement {
  const labels = issue.labels.map((l) => l.name);
  return {
    number: String(issue.number),
    title: issue.title.trim(),
    stage: labels.find((l) => l.startsWith('stage/'))?.slice('stage/'.length),
    tracking: trackingStatus(labels),
    sigs: labels.filter((l) => l.startsWith('sig/')).map((l) => `sig-${l.slice('sig/'.length)}`),
    state: issue.state === 'open' ? 'open' : 'closed',
    url: issue.html_url,
  };
}

type TrackingCache = Record<string, { data: TrackedEnhancement[]; timestamp: number }>;

/** Enhancements opted in to `milestone` (issues labelled lead-opted-in). */
export async function fetchTrackedEnhancements(milestone: ReleaseMilestone): Promise<TrackedEnhancement[]> {
  const now = Date.now();
  const cached = readCache<TrackingCache>(CACHE_KEY_TRACKING)?.[milestone.title];
  if (cached && now - cached.timestamp < CACHE_TTL) return cached.data;

  const issues: GitHubIssue[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const resp = await githubFetch(
      `${GITHUB_API_BASE}/repos/${REPO}/issues?milestone=${milestone.number}&labels=lead-opted-in&state=all&per_page=${PAGE_SIZE}&page=${page}`,
    );
    if (resp.status === 403 || resp.status === 429)
      throw new Error('GitHub API rate limit exceeded. Please try again later.');
    if (!resp.ok) throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
    const batch = (await resp.json()) as GitHubIssue[];
    issues.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  // The issues endpoint also returns pull requests in the milestone.
  const data = issues.filter((i) => !i.pull_request).map(toTrackedEnhancement);

  const latest = readCache<TrackingCache>(CACHE_KEY_TRACKING) ?? {};
  const pruned = Object.fromEntries(Object.entries(latest).filter(([, e]) => now - e.timestamp < CACHE_TTL));
  setCache(CACHE_KEY_TRACKING, { ...pruned, [milestone.title]: { data, timestamp: now } });
  return data;
}

/**
 * Updates `items` with issues changed since `since` (ISO time): one request
 * for recently updated issues across the repo. Issues still opted in to
 * `milestone` are replaced or added; ones that left it are removed. Returns
 * null if there were too many changes to see in one page.
 */
export async function applyTrackingChangesSince(
  milestone: ReleaseMilestone,
  items: TrackedEnhancement[],
  since: string,
): Promise<TrackedEnhancement[] | null> {
  const resp = await githubFetch(
    `${GITHUB_API_BASE}/repos/${REPO}/issues?state=all&since=${encodeURIComponent(since)}&per_page=${PAGE_SIZE}`,
  );
  if (!resp.ok) return null;
  const updated = ((await resp.json()) as GitHubIssue[]).filter((i) => !i.pull_request);
  if (updated.length >= PAGE_SIZE) return null;

  const byNumber = new Map(items.map((i) => [i.number, i]));
  for (const issue of updated) {
    const inRelease =
      issue.milestone?.number === milestone.number && issue.labels.some((l) => l.name === 'lead-opted-in');
    if (inRelease) byNumber.set(String(issue.number), toTrackedEnhancement(issue));
    else byNumber.delete(String(issue.number));
  }
  return [...byNumber.values()];
}
