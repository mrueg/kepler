// Data prebuilt during deploy (scripts/fetch-data.ts) and served as static
// JSON under /data, so visitors don't have to crawl GitHub themselves. Every
// loader falls back to fetching live when a snapshot is missing (e.g. in
// local development) or too old (e.g. scheduled deploys stopped running).

export interface Snapshot<T> {
  /** ISO time the data was fetched. */
  generatedAt: string;
  data: T;
}

export type SnapshotName =
  | 'keps'
  | 'geps'
  | 'caeps'
  | 'recent-keps'
  | 'recent-geps'
  | 'release-tracking';

/** Snapshots older than this are ignored in favour of live data. */
export const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function snapshotUrl(name: SnapshotName): string {
  return `${BASE_PATH}/data/${name}.json`;
}

const pending = new Map<SnapshotName, Promise<Snapshot<unknown> | null>>();

/** Fetches a snapshot once per page load; null if missing, invalid or stale. */
export function loadSnapshot<T>(name: SnapshotName): Promise<Snapshot<T> | null> {
  let promise = pending.get(name);
  if (!promise) {
    promise = (async () => {
      try {
        const resp = await fetch(snapshotUrl(name));
        if (!resp.ok) return null;
        const snapshot = (await resp.json()) as Snapshot<unknown>;
        const age = Date.now() - Date.parse(snapshot.generatedAt);
        if (!(age >= 0 && age < SNAPSHOT_MAX_AGE_MS) || snapshot.data === undefined) return null;
        return snapshot;
      } catch {
        return null;
      }
    })();
    pending.set(name, promise);
  }
  return promise as Promise<Snapshot<T> | null>;
}

/** For tests: forget loaded snapshots. */
export function resetSnapshots(): void {
  pending.clear();
}
