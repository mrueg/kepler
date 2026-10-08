import { vi } from 'vitest';

type Route = (url: string, init?: RequestInit) => Response | undefined;

/** Stubs global fetch with a router function; unmatched URLs return 404. */
export function stubFetch(route: Route) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    return route(url, init) ?? new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}
