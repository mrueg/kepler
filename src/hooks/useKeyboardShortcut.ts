'use client';

import { useEffect } from 'react';

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
