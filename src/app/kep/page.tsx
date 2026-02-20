'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { KepDetailPage } from '../../views/KepDetailPage';

function KepPageContent() {
  const searchParams = useSearchParams();
  const number = searchParams.get('number');
  if (!number || !/^\d+$/.test(number)) {
    return (
      <div className="detail-error">
        <p>Invalid or missing KEP number.</p>
        <Link href="/" className="back-link">
          ← Back to list
        </Link>
      </div>
    );
  }
  return <KepDetailPage number={number} />;
}

export default function KepPage() {
  return (
    <Suspense fallback={<div className="detail-loading"><div className="spinner" /></div>}>
      <KepPageContent />
    </Suspense>
  );
}
