'use client';

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'kepler_bookmarks_v1';

export interface UseBookmarksResult {
  bookmarks: Set<string>;
  toggleBookmark: (number: string) => void;
  isBookmarked: (number: string) => boolean;
}

export function useBookmarks(): UseBookmarksResult {
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (number: string) => bookmarks.has(number),
    [bookmarks],
  );

  return { bookmarks, toggleBookmark, isBookmarked };
}
