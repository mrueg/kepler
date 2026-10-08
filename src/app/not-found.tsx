import Link from 'next/link';

// Exported as 404.html, which GitHub Pages serves for unknown paths.
export default function NotFound() {
  return (
    <div className="detail-error">
      <h1 className="error-page-title">Page not found</h1>
      <p>There&apos;s nothing at this address.</p>
      <div className="error-page-actions">
        <Link href="/" className="back-link">
          ← KEPs
        </Link>
        <Link href="/gep" className="back-link">
          ← GEPs
        </Link>
      </div>
    </div>
  );
}
