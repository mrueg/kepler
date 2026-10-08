'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CaepSection } from '../../views/CaepSection';
import { CaepDetailPage } from '../../views/CaepDetailPage';

function CaepPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  if (id !== null) {
    // Ids are proposal file names: YYYYMMDD-slug.
    if (!/^\d{8}-[^/]+$/.test(id)) {
      return (
        <div className="detail-error">
          <p>Invalid CAEP id.</p>
          <Link href="/caep" className="back-link">
            ← Back to CAEPs
          </Link>
        </div>
      );
    }
    // Keyed so navigating to another CAEP starts from fresh state.
    return <CaepDetailPage key={id} id={id} />;
  }

  return <CaepSection />;
}

export default function CaepPage() {
  return (
    <Suspense fallback={<div className="detail-loading"><div className="spinner" /></div>}>
      <CaepPageContent />
    </Suspense>
  );
}
