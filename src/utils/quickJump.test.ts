import { describe, expect, it } from 'vitest';
import { proposalHref, searchJumpTargets, type JumpTarget, type ProposalKind } from './quickJump';

const t = (kind: ProposalKind, number: string, title: string): JumpTarget => ({ kind, number, title, href: proposalHref(kind, number) });

const targets = [
  t('KEP', '753', 'Sidecar Containers'),
  t('KEP', '7530', 'Something else'),
  t('KEP', '75', 'Old one'),
  t('GEP', '753', 'Gateway sidecar thing'),
  t('KEP', '2400', 'Node swap support'),
  t('KEP', '1287', 'In-place Update of Pod Resources'),
];

const ids = (results: JumpTarget[]) => results.map((r) => `${r.kind}-${r.number}`);

describe('searchJumpTargets', () => {
  it('puts exact number matches first, then prefixes', () => {
    expect(ids(searchJumpTargets('753', targets))).toEqual(['KEP-753', 'GEP-753', 'KEP-7530']);
    expect(ids(searchJumpTargets('75', targets))).toEqual(['KEP-75', 'KEP-753', 'GEP-753', 'KEP-7530']);
  });

  it('understands KEP-/GEP- prefixes and #', () => {
    expect(ids(searchJumpTargets('gep-753', targets))).toEqual(['GEP-753']);
    expect(ids(searchJumpTargets('KEP 753', targets))).toEqual(['KEP-753', 'KEP-7530']);
    expect(ids(searchJumpTargets('#2400', targets))).toEqual(['KEP-2400']);
  });

  it('links unknown numbers directly, assuming KEP for bare numbers', () => {
    expect(searchJumpTargets('99999', targets)).toEqual([t('KEP', '99999', '')]);
    expect(searchJumpTargets('gep 5', [])).toEqual([t('GEP', '5', '')]);
    expect(searchJumpTargets('0753', targets)[0]).toMatchObject({ kind: 'KEP', number: '753' });
  });

  it('ranks title matches: start, then word start, then anywhere', () => {
    expect(ids(searchJumpTargets('sidecar', targets))).toEqual(['KEP-753', 'GEP-753']);
    expect(ids(searchJumpTargets('pod', targets))).toEqual(['KEP-1287']);
    expect(ids(searchJumpTargets('wap', targets))).toEqual(['KEP-2400']);
  });

  it('handles empty and regex-like queries', () => {
    expect(searchJumpTargets('  ', targets)).toEqual([]);
    expect(ids(searchJumpTargets('in-place (', targets))).toEqual([]);
    expect(ids(searchJumpTargets('in-place', targets))).toEqual(['KEP-1287']);
  });

  it('respects the limit', () => {
    expect(searchJumpTargets('e', targets, 2)).toHaveLength(2);
  });
});
