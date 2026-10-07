'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type KeyHandler = (e: KeyboardEvent) => void;

/**
 * Registers a keydown event listener on the document.
 * The handler is only called when no input/textarea/select/contenteditable element is focused.
 */
export function useKeyboardShortcut(handler: KeyHandler, skip = false) {
  useEffect(() => {
    if (skip) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }
      handler(e);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handler, skip]);
}

/**
 * Detail-page shortcuts: `b` toggles the bookmark, ←/→ move to the previous or
 * next proposal number returned by `getNumbers`.
 */
export function useDetailShortcuts({
  number,
  getNumbers,
  hrefFor,
  toggleBookmark,
}: {
  number: string;
  getNumbers: () => string[];
  hrefFor: (number: string) => string;
  toggleBookmark: (number: string) => void;
}) {
  const router = useRouter();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'b') {
      toggleBookmark(number);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const numbers = getNumbers().sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      const idx = numbers.indexOf(number);
      if (idx === -1) return;
      const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
      if (nextIdx >= 0 && nextIdx < numbers.length) {
        router.push(hrefFor(numbers[nextIdx]));
      }
    }
  }, [number, getNumbers, hrefFor, toggleBookmark, router]);

  useKeyboardShortcut(handleKeyDown);
}
