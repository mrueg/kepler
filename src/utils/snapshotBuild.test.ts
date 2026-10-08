import { describe, expect, it } from 'vitest';
import { isComplete, truncateText } from './snapshotBuild';

describe('snapshot build helpers', () => {
  it('truncates long text', () => {
    expect(truncateText('abcdef', 3)).toBe('abc');
    expect(truncateText(undefined)).toBeUndefined();
  });

  it('accepts a small shortfall but not a partial crawl', () => {
    expect(isComplete(640, 642)).toBe(true);
    expect(isComplete(65, 65)).toBe(true);
    expect(isComplete(600, 642)).toBe(false);
    expect(isComplete(0, 0)).toBe(false);
  });
});
