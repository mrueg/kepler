// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useKepBookmarks } from './useBookmarks';

const KEY = 'kepler_bookmarks_v1';

describe('useKepBookmarks', () => {
  it('loads, toggles and persists bookmarks', () => {
    localStorage.setItem(KEY, JSON.stringify(['1']));
    const { result } = renderHook(() => useKepBookmarks());
    expect(result.current.isBookmarked('1')).toBe(true);

    act(() => result.current.toggleBookmark('2'));
    act(() => result.current.toggleBookmark('1'));

    expect([...result.current.bookmarks]).toEqual(['2']);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['2']);
  });

  it('picks up bookmarks changed in another tab', () => {
    const { result } = renderHook(() => useKepBookmarks());
    expect(result.current.bookmarks.size).toBe(0);

    // Another tab writes the key; the browser then fires a storage event here.
    localStorage.setItem(KEY, JSON.stringify(['753']));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(result.current.isBookmarked('753')).toBe(true);

    // Events for other keys are ignored.
    localStorage.setItem(KEY, JSON.stringify([]));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'something_else' }));
    });
    expect(result.current.isBookmarked('753')).toBe(true);
  });
});
