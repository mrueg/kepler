'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Shown instead of a blank page when rendering throws unexpectedly.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="detail-error" role="alert">
      <h1 className="error-page-title">Something went wrong</h1>
      <p>{error.message || 'An unexpected error occurred.'}</p>
      <div className="error-page-actions">
        <button className="retry-btn" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="back-link">
          ← Back to KEPs
        </Link>
      </div>
    </div>
  );
}
