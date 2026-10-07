import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** How long to wait after the last change before updating the URL. */
const URL_SYNC_DELAY_MS = 300;

/**
 * Mirrors `params` into the page's query string, debounced so typing in the
 * search box doesn't trigger a router navigation on every keystroke.
 * `emptyPath` is navigated to when there are no params.
 */
export function useUrlSync(params: URLSearchParams, emptyPath: string): void {
  const { replace } = useRouter();
  const qs = params.toString();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const newSearch = qs ? `?${qs}` : '';
      if (newSearch !== window.location.search) {
        replace(newSearch || emptyPath, { scroll: false });
      }
    }, URL_SYNC_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [qs, emptyPath, replace]);
}
