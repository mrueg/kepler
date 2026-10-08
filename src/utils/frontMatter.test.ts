import { describe, expect, it } from 'vitest';
import { firstHeading, parseFrontMatter, parseLooseFrontMatter } from './frontMatter';

describe('parseFrontMatter', () => {
  it('parses valid YAML front matter and returns the body without it', () => {
    const { data, body } = parseFrontMatter('---\ntitle: Foo\nauthors:\n  - "@a"\n---\n\n# Foo\n');
    expect(data).toEqual({ title: 'Foo', authors: ['@a'] });
    expect(body).toBe('\n# Foo\n');
  });

  it('returns the whole document when there is no front matter', () => {
    expect(parseFrontMatter('Machines API\n===\n')).toEqual({ data: {}, body: 'Machines API\n===\n' });
  });

  it('falls back to the loose parser for invalid YAML', () => {
    const { data } = parseFrontMatter('---\ntitle: T\nreviewers:\n- @sbueringer\n- @vincepri\n---\nbody');
    expect(data.reviewers).toEqual(['@sbueringer', '@vincepri']);
  });
});

// Shapes taken from real cluster-api proposals that YAML parsers reject.
describe('parseLooseFrontMatter', () => {
  it('handles * bullets, blank lines and N/A placeholders', () => {
    expect(parseLooseFrontMatter('authors:\n* "@wfernandes"\nreviewers:\n* "@ncdc"\n* "@vincepri"\n\n\ncreation-date: 2020-04-27\nreplaces:\n* N/A')).toEqual({
      authors: ['@wfernandes'],
      reviewers: ['@ncdc', '@vincepri'],
      'creation-date': '2020-04-27',
      replaces: ['N/A'],
    });
  });

  it('treats a bare URL under a key as a list item, not a key', () => {
    expect(parseLooseFrontMatter('see-also:\nhttps://github.com/x/y/blob/main/docs/proposals/20191016-a.md\nstatus: implementable')).toEqual({
      'see-also': ['https://github.com/x/y/blob/main/docs/proposals/20191016-a.md'],
      status: 'implementable',
    });
  });

  it('keeps the quoted value when a note follows it, and drops comments but not URL fragments', () => {
    expect(parseLooseFrontMatter('authors:\n- "@arvinderpal" (original proposal author)\n- "@b" # note\nsee-also:\n- "[Rules](https://k8s.io/docs/policy/#fields)"')).toEqual({
      authors: ['@arvinderpal', '@b'],
      'see-also': ['[Rules](https://k8s.io/docs/policy/#fields)'],
    });
  });

  it('leaves keys without values empty', () => {
    expect(parseLooseFrontMatter('title: X\nreplaces:\nsuperseded-by:')).toEqual({ title: 'X', replaces: undefined, 'superseded-by': undefined });
  });
});

describe('firstHeading', () => {
  it('finds ATX and setext headings', () => {
    expect(firstHeading('intro\n\n# In-place updates  \n## Sub')).toBe('In-place updates');
    expect(firstHeading('Minimalistic Machines API\n=========================\ntext')).toBe('Minimalistic Machines API');
    expect(firstHeading('no headings here')).toBeUndefined();
  });
});
