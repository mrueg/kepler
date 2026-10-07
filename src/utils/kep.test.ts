import { describe, expect, it, vi } from 'vitest';
import type { Kep } from '../types/kep';
import {
  compareVersions,
  formatKepDate,
  formatSig,
  getKepDate,
  isStale,
  kepDisplayTitle,
  kepSearchText,
  normalizeVersion,
  sortKeps,
} from './kep';

function kep(overrides: Partial<Kep> = {}): Kep {
  return {
    path: 'keps/sig-node/1234-foo-bar/kep.yaml',
    number: '1234',
    sig: 'sig-node',
    slug: 'foo-bar',
    githubUrl: 'https://github.com/kubernetes/enhancements/tree/master/keps/sig-node/1234-foo-bar',
    ...overrides,
  };
}

describe('formatKepDate', () => {
  it('does not shift YYYY-MM-DD dates into the previous day west of UTC', () => {
    expect(formatKepDate(new Date('2023-01-15'))).toBe('Jan 15, 2023');
    expect(formatKepDate(new Date('2023-01-01'), { year: 'numeric' })).toBe('2023');
  });
});

describe('getKepDate', () => {
  it('prefers last-updated over creation-date', () => {
    expect(getKepDate(kep({ 'creation-date': '2020-01-01', 'last-updated': '2021-02-03' }))?.toISOString())
      .toBe('2021-02-03T00:00:00.000Z');
  });

  it('returns null for missing or invalid dates', () => {
    expect(getKepDate(kep())).toBeNull();
    expect(getKepDate(kep({ 'creation-date': 'not a date' }))).toBeNull();
  });
});

describe('isStale', () => {
  it('flags provisional/implementable KEPs not updated in over a year', () => {
    vi.useFakeTimers({ now: new Date('2026-06-01') });
    try {
      expect(isStale(kep({ status: 'provisional', 'last-updated': '2025-01-01' }))).toBe(true);
      expect(isStale(kep({ status: 'implementable', 'last-updated': '2026-01-01' }))).toBe(false);
      expect(isStale(kep({ status: 'implemented', 'last-updated': '2020-01-01' }))).toBe(false);
      expect(isStale(kep({ status: 'provisional' }))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('formatSig / kepDisplayTitle', () => {
  it('formats SIG names and falls back to the slug for titles', () => {
    expect(formatSig('sig-api-machinery')).toBe('SIG api machinery');
    expect(kepDisplayTitle(kep({ title: 'Real Title' }))).toBe('Real Title');
    expect(kepDisplayTitle(kep())).toBe('foo bar');
  });
});

describe('sortKeps', () => {
  const a = kep({ number: '1', title: 'Alpha', sig: 'sig-b', 'creation-date': '2020-01-01' });
  const b = kep({ number: '2', title: 'beta', sig: 'sig-a', 'last-updated': '2022-01-01' });
  const c = kep({ number: '3', slug: 'charlie', sig: 'sig-c', 'creation-date': '2021-01-01' });

  it('returns the input unchanged without a sort key', () => {
    const input = [c, a, b];
    expect(sortKeps(input, undefined, 'asc')).toBe(input);
  });

  it('sorts case-insensitively by title, falling back to the slug', () => {
    expect(sortKeps([c, b, a], 'title', 'asc').map((k) => k.number)).toEqual(['1', '2', '3']);
    expect(sortKeps([c, b, a], 'title', 'desc').map((k) => k.number)).toEqual(['3', '2', '1']);
  });

  it('sorts by last-updated, falling back to creation-date', () => {
    expect(sortKeps([b, c, a], 'last-updated', 'asc').map((k) => k.number)).toEqual(['1', '3', '2']);
  });

  it('sorts by SIG without mutating the input', () => {
    const input = [a, b, c];
    expect(sortKeps(input, 'sig', 'asc').map((k) => k.sig)).toEqual(['sig-a', 'sig-b', 'sig-c']);
    expect(input).toEqual([a, b, c]);
  });
});

describe('normalizeVersion / compareVersions', () => {
  it('normalizes versions to major.minor', () => {
    expect(normalizeVersion('v1.32')).toBe('1.32');
    expect(normalizeVersion('1.9.3')).toBe('1.9');
    expect(normalizeVersion('next')).toBeNull();
    expect(normalizeVersion(undefined)).toBeNull();
  });

  it('compares numerically rather than lexically', () => {
    expect(['v1.10', 'v1.9', 'v1.32', 'v1.2'].sort(compareVersions)).toEqual(['v1.2', 'v1.9', 'v1.10', 'v1.32']);
  });

  it('sorts unparseable versions first', () => {
    expect(['v1.1', 'tbd'].sort(compareVersions)).toEqual(['tbd', 'v1.1']);
  });
});

describe('kepSearchText', () => {
  it('includes title, number, slug, authors and README, lowercased', () => {
    const text = kepSearchText(kep({ title: 'Sidecar Containers', authors: ['@SomeOne'], readme: 'Pod LIFECYCLE' }));
    for (const q of ['sidecar', '1234', 'foo-bar', '@someone', 'pod lifecycle']) {
      expect(text).toContain(q);
    }
  });
});
