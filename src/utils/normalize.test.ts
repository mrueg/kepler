import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';
import { asString, asStringList, normalizeGepMetadata, normalizeKepMetadata } from './normalize';

describe('asString / asStringList', () => {
  it('coerces numbers and YAML dates, drops other types', () => {
    expect(asString('  sig-node ')).toBe('sig-node');
    expect(asString(1.3)).toBe('1.3');
    expect(asString(new Date('2023-01-15'))).toBe('2023-01-15');
    expect(asString({})).toBeUndefined();
    expect(asString('')).toBeUndefined();
  });

  it('wraps single values and filters out non-strings', () => {
    expect(asStringList('@someone')).toEqual(['@someone']);
    expect(asStringList(['@a', null, 42, { x: 1 }])).toEqual(['@a', '42']);
    expect(asStringList([])).toBeUndefined();
    expect(asStringList(null)).toBeUndefined();
  });
});

describe('normalizeKepMetadata', () => {
  it('keeps well-formed metadata intact', () => {
    const meta = normalizeKepMetadata(load(`
title: Sidecar Containers
status: implementable
authors: ["@a", "@b"]
creation-date: 2019-01-15
milestone:
  alpha: "v1.28"
  beta: v1.29
latest-milestone: "v1.29"
`));
    expect(meta).toEqual({
      title: 'Sidecar Containers',
      status: 'implementable',
      authors: ['@a', '@b'],
      'creation-date': '2019-01-15',
      milestone: { alpha: 'v1.28', beta: 'v1.29' },
      'latest-milestone': 'v1.29',
    });
  });

  it('repairs fields with the wrong shape instead of crashing later', () => {
    const meta = normalizeKepMetadata(load(`
title: 123
authors: "@only-one"
reviewers: { not: a list }
see-also: 1234
milestone: v1.20
`));
    expect(meta.title).toBe('123');
    expect(meta.authors).toEqual(['@only-one']);
    expect(meta.reviewers).toBeUndefined();
    expect(meta['see-also']).toEqual(['1234']);
    expect(meta.milestone).toBeUndefined();
  });

  it('returns empty metadata for non-object YAML', () => {
    expect(normalizeKepMetadata(load('just a string'))).toEqual({});
    expect(normalizeKepMetadata(null)).toEqual({});
  });
});

describe('normalizeGepMetadata', () => {
  it('requires a number and a name', () => {
    expect(normalizeGepMetadata(load('name: Foo'))).toBeNull();
    expect(normalizeGepMetadata(load('number: 1'))).toBeNull();
    expect(normalizeGepMetadata(load('- a list'))).toBeNull();
  });

  it('normalizes relationships and lists', () => {
    const meta = normalizeGepMetadata(load(`
number: "713"
name: Metaresources
status: Experimental
authors: someone
relationships:
  extends:
    - number: 1
      name: Base
    - name: missing number
  seeAlso: not-a-list
references: https://example.com
`));
    expect(meta).toEqual({
      number: 713,
      name: 'Metaresources',
      status: 'Experimental',
      authors: ['someone'],
      relationships: { extends: [{ number: 1, name: 'Base' }] },
      references: ['https://example.com'],
    });
  });
});
