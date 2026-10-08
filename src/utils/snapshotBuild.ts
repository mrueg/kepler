// Helpers for scripts/fetch-data.ts, kept here so they're unit-tested.

/** Longest proposal text kept in snapshots; enough for full-text search. */
export const SNAPSHOT_TEXT_LIMIT = 5000;

export function truncateText(text: string | undefined, limit = SNAPSHOT_TEXT_LIMIT): string | undefined {
  return text === undefined ? undefined : text.slice(0, limit);
}

/**
 * Whether a crawl got (nearly) everything. A few files legitimately fail to
 * parse (two kep.yaml files currently aren't valid YAML), so allow a small
 * shortfall; anything more suggests rate limiting or an outage, and shipping
 * a partial list would hide proposals for hours.
 */
export function isComplete(loaded: number, expected: number, tolerance = 0.02): boolean {
  return expected > 0 && loaded >= Math.floor(expected * (1 - tolerance));
}
