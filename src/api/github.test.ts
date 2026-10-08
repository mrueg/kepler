import { afterEach, describe, expect, it, vi } from 'vitest';
import { findKepPath, parseKepPath, titleMentionsKep } from './github';
import { json, stubFetch } from '../test/fetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseKepPath', () => {
  it('extracts SIG, number and slug', () => {
    expect(parseKepPath('keps/sig-node/753-sidecar-containers/kep.yaml'))
      .toEqual({ sig: 'sig-node', number: '753', slug: 'sidecar-containers' });
  });

  it('rejects other files and layouts', () => {
    expect(parseKepPath('keps/sig-node/753-sidecar-containers/README.md')).toBeNull();
    expect(parseKepPath('keps/prod-readiness/sig-node/753.yaml')).toBeNull();
  });
});

describe('findKepPath', () => {
  it('fetches the repo tree when nothing is cached (shared links on a first visit)', async () => {
    const fetchMock = stubFetch((url) =>
      url.includes('/git/trees/')
        ? json({
            tree: [
              { path: 'keps/sig-node/753-sidecar-containers/kep.yaml', type: 'blob' },
              { path: 'keps/sig-apps/7530-other/kep.yaml', type: 'blob' },
            ],
          })
        : undefined,
    );

    await expect(findKepPath('753')).resolves.toBe('keps/sig-node/753-sidecar-containers/kep.yaml');
    await expect(findKepPath('9999')).resolves.toBeNull();
    // The second lookup is served from the tree cache.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('titleMentionsKep', () => {
  it('matches the KEP number as a whole number', () => {
    expect(titleMentionsKep('KEP-12: graduate to beta', '12')).toBe(true);
    expect(titleMentionsKep('Update kep 12 for v1.30', '12')).toBe(true);
    expect(titleMentionsKep('12', '12')).toBe(true);
  });

  it('does not match longer numbers containing it', () => {
    expect(titleMentionsKep('KEP-1234: graduate to beta', '12')).toBe(false);
    expect(titleMentionsKep('KEP-312: graduate to beta', '12')).toBe(false);
  });
});
