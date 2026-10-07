'use client';

import { useState, useCallback } from 'react';

const KEP_STORAGE_KEY = 'kepler_bookmarks_v1';
const GEP_STORAGE_KEY = 'kepler_gep_bookmarks_v1';

export interface UseBookmarksResult {
  bookmarks: Set<string>;
  toggleBookmark: (number: string) => void;
  isBookmarked: (number: string) => boolean;
}

function useBookmarks(storageKey: string): UseBookmarksResult {
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleBookmark = useCallback((number: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(number)) {
        next.delete(number);
      } else {
        next.add(number);
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, [storageKey]);

  const isBookmarked = useCallback(
    (number: string) => bookmarks.has(number),
    [bookmarks],
  );

  return { bookmarks, toggleBookmark, isBookmarked };
}

export function useKepBookmarks(): UseBookmarksResult {
  return useBookmarks(KEP_STORAGE_KEY);
}

export function useGepBookmarks(): UseBookmarksResult {
  return useBookmarks(GEP_STORAGE_KEY);
}
