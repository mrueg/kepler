import type { KepFeatureGate, KepMetadata, KepMilestone, KepStage, KepStatus } from '../types/kep';
import type { GepMetadata, GepRelationship, GepRelationships, GepStatus } from '../types/gep';

// Proposal metadata is hand-written YAML, so any field can have an unexpected
// shape (a string where a list is expected, a number where a string is, a date
// parsed by js-yaml, ...). These helpers coerce what can be coerced and drop the
// rest, so one malformed file can't crash the UI.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Strings pass through; numbers become strings; dates become YYYY-MM-DD. */
export function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  // js-yaml parses unquoted YYYY-MM-DD values as Date objects.
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().split('T')[0];
  return undefined;
}

/** A list of strings; a single string becomes a one-item list. */
export function asStringList(value: unknown): string[] | undefined {
  const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const strings = items.map(asString).filter((s): s is string => s !== undefined);
  return strings.length > 0 ? strings : undefined;
}

function asNumber(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function withoutUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  // YAML 1.2 (js-yaml) reads yes/no as strings; at least one kep.yaml uses them.
  const s = typeof value === 'string' ? value.trim().toLowerCase() : undefined;
  if (s === 'true' || s === 'yes') return true;
  if (s === 'false' || s === 'no') return false;
  return undefined;
}

/** Feature gates as `{ name, components }` entries; bare strings are gate names. */
function asFeatureGates(value: unknown): KepFeatureGate[] | undefined {
  const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const gates = items.flatMap((item): KepFeatureGate[] => {
    const name = asString(isRecord(item) ? item.name : item);
    if (!name) return [];
    return [withoutUndefined({ name, components: isRecord(item) ? asStringList(item.components) : undefined })];
  });
  return gates.length > 0 ? gates : undefined;
}

function asMilestone(value: unknown): KepMilestone | undefined {
  if (!isRecord(value)) return undefined;
  const milestone = withoutUndefined({
    alpha: asString(value.alpha),
    beta: asString(value.beta),
    stable: asString(value.stable),
  });
  return Object.keys(milestone).length > 0 ? milestone : undefined;
}

export function normalizeKepMetadata(raw: unknown): KepMetadata {
  const r = isRecord(raw) ? raw : {};
  return withoutUndefined({
    title: asString(r.title),
    status: asString(r.status) as KepStatus | undefined,
    authors: asStringList(r.authors),
    'owning-sig': asString(r['owning-sig']),
    reviewers: asStringList(r.reviewers),
    approvers: asStringList(r.approvers),
    editor: asString(r.editor),
    'creation-date': asString(r['creation-date']),
    'last-updated': asString(r['last-updated']),
    'see-also': asStringList(r['see-also']),
    replaces: asStringList(r.replaces),
    'superseded-by': asStringList(r['superseded-by']),
    stage: asString(r.stage) as KepStage | undefined,
    milestone: asMilestone(r.milestone),
    'participating-sigs': asStringList(r['participating-sigs']),
    'latest-milestone': asString(r['latest-milestone']),
    'kep-number': asNumber(r['kep-number']),
    'prr-approvers': asStringList(r['prr-approvers']),
    'feature-gates': asFeatureGates(r['feature-gates']),
    'disable-supported': asBoolean(r['disable-supported']),
  });
}

function asRelationships(value: unknown): GepRelationship[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const relationships = value.flatMap((item): GepRelationship[] => {
    if (!isRecord(item)) return [];
    const number = asNumber(item.number);
    if (number === undefined) return [];
    return [withoutUndefined({
      number,
      name: asString(item.name) ?? `GEP-${number}`,
      description: asString(item.description),
    })];
  });
  return relationships.length > 0 ? relationships : undefined;
}

/** Returns null when the required `number` or `name` is missing. */
export function normalizeGepMetadata(raw: unknown): GepMetadata | null {
  if (!isRecord(raw)) return null;
  const number = asNumber(raw.number);
  const name = asString(raw.name);
  if (number === undefined || name === undefined) return null;

  const rel = isRecord(raw.relationships) ? raw.relationships : {};
  const relationships: GepRelationships = withoutUndefined({
    extends: asRelationships(rel.extends),
    obsoletes: asRelationships(rel.obsoletes),
    seeAlso: asRelationships(rel.seeAlso),
  });

  return withoutUndefined({
    apiVersion: asString(raw.apiVersion),
    kind: asString(raw.kind),
    number,
    name,
    status: asString(raw.status) as GepStatus,
    authors: asStringList(raw.authors),
    relationships: Object.keys(relationships).length > 0 ? relationships : undefined,
    references: asStringList(raw.references),
    changelog: asStringList(raw.changelog),
  });
}
