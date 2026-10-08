import { afterEach, describe, expect, it, vi } from 'vitest';
import { CACHE_KEY_CAEPS, caepIdFromReference, fetchAllCaeps, findCaepPath, parseCaep, parseCaepPath } from './clusterapi';
import { readCache } from './shared';
import { json, stubFetch } from '../test/fetch';
import type { Caep } from '../types/caep';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseCaepPath', () => {
  it('reads the id and date from the file name, including archived proposals', () => {
    expect(parseCaepPath('docs/proposals/20191017-kubeadm-based-control-plane.md')).toEqual({
      id: '20191017-kubeadm-based-control-plane',
      date: '2019-10-17',
      archived: false,
    });
    expect(parseCaepPath('docs/proposals/archived/20210222-kubelet-authentication.md')?.archived).toBe(true);
    expect(parseCaepPath('docs/proposals/20250124-From CAPD(docker) to CAPD(dev) .md')?.id).toBe('20250124-From CAPD(docker) to CAPD(dev) ');
  });

  it('skips the template, images and other files', () => {
    expect(parseCaepPath('docs/proposals/YYYYMMDD-template.md')).toBeNull();
    expect(parseCaepPath('docs/proposals/images/foo.png')).toBeNull();
    expect(parseCaepPath('docs/book/src/index.md')).toBeNull();
  });
});

describe('parseCaep', () => {
  it('reads front matter, drops N/A references and strips typographic quotes from handles', () => {
    const caep = parseCaep(
      'docs/proposals/20200511-templating.md',
      '---\ntitle: Templating\nauthors:\n* "@wfernandes"\n* “@pydctw”\nstatus: Implementable\nreplaces:\n* N/A\n---\n# Templating\n',
    );
    expect(caep).toMatchObject({
      id: '20200511-templating',
      title: 'Templating',
      authors: ['@wfernandes', '@pydctw'],
      status: 'implementable',
      date: '2020-05-11',
      githubUrl: 'https://github.com/kubernetes-sigs/cluster-api/blob/main/docs/proposals/20200511-templating.md',
      githubDirUrl: 'https://github.com/kubernetes-sigs/cluster-api/tree/main/docs/proposals',
      content: '# Templating\n',
    });
    expect(caep.replaces).toBeUndefined();
  });

  it('falls back to the first heading, then the file name, for the title', () => {
    expect(parseCaep('docs/proposals/20181121-machine-api.md', 'Minimalistic Machines API\n===\n').title).toBe('Minimalistic Machines API');
    expect(parseCaep('docs/proposals/20181121-machine-api.md', 'no heading').title).toBe('machine api');
  });

  it('ignores unknown status values such as the template placeholder', () => {
    expect(parseCaep('docs/proposals/20200101-x.md', '---\nstatus: provisional|implementable\n---\n').status).toBeUndefined();
  });

  it('encodes unusual file names in GitHub URLs', () => {
    expect(parseCaep('docs/proposals/20250124-From CAPD(docker) to CAPD(dev) .md', '').githubUrl).toBe(
      'https://github.com/kubernetes-sigs/cluster-api/blob/main/docs/proposals/20250124-From%20CAPD(docker)%20to%20CAPD(dev)%20.md',
    );
  });
});

describe('caepIdFromReference', () => {
  it('recognises repo paths and GitHub URLs to other proposals', () => {
    expect(caepIdFromReference('/docs/proposals/20191016-clusterctl-redesign.md')).toBe('20191016-clusterctl-redesign');
    expect(caepIdFromReference('https://github.com/kubernetes-sigs/cluster-api/blob/main/docs/proposals/20200506-conditions.md')).toBe('20200506-conditions');
    expect(caepIdFromReference('docs/proposals/archived/20210222-kubelet-authentication.md#goals')).toBe('20210222-kubelet-authentication');
    expect(caepIdFromReference('https://github.com/kubernetes-sigs/cluster-api/issues/2339')).toBeNull();
  });
});

describe('fetchAllCaeps / findCaepPath', () => {
  function stubRepo() {
    return stubFetch((url) => {
      if (url.includes('/git/trees/')) {
        return json({
          tree: [
            { path: 'docs/proposals/20200101-old.md', type: 'blob' },
            { path: 'docs/proposals/20240101-new.md', type: 'blob' },
            { path: 'docs/proposals/YYYYMMDD-template.md', type: 'blob' },
            { path: 'docs/proposals/archived/20210101-gone.md', type: 'blob' },
          ],
        });
      }
      if (url.endsWith('/20200101-old.md')) return new Response('---\ntitle: Old\n---\nbody');
      if (url.endsWith('/20240101-new.md')) return new Response('---\ntitle: New\nstatus: provisional\n---\nbody');
      if (url.endsWith('/archived/20210101-gone.md')) return new Response('# Gone');
      return undefined;
    });
  }

  it('fetches every proposal, newest first, and caches them without bodies', async () => {
    const fetchMock = stubRepo();
    const caeps = await fetchAllCaeps();

    expect(caeps.map((c) => [c.id, c.title, c.archived])).toEqual([
      ['20240101-new', 'New', false],
      ['20210101-gone', 'Gone', true],
      ['20200101-old', 'Old', false],
    ]);
    expect(caeps[0].content).toBe('body');
    expect(readCache<Caep[]>(CACHE_KEY_CAEPS)?.every((c) => c.content === undefined)).toBe(true);
    // One API call for the tree; proposal files come from raw.githubusercontent.com.
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('api.github.com'))).toHaveLength(1);
  });

  it('finds a proposal path by id', async () => {
    stubRepo();
    await expect(findCaepPath('20210101-gone')).resolves.toBe('docs/proposals/archived/20210101-gone.md');
    await expect(findCaepPath('20990101-nope')).resolves.toBeNull();
  });
});
