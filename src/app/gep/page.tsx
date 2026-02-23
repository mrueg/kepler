'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GepSection } from '../../views/GepSection';
import { GepDetailPage } from '../../views/GepDetailPage';

function GepPageContent() {
  const searchParams = useSearchParams();
  const number = searchParams.get('number');

  if (number !== null) {
    if (!/^\d+$/.test(number)) {
      return (
        <div className="detail-error">
          <p>Invalid GEP number.</p>
          <Link href="/gep" className="back-link">
            ← Back to GEPs
          </Link>
        </div>
      );
    }
    return <GepDetailPage number={number} />;
  }

  return <GepSection />;
}

export default function GepPage() {
  return (
    <Suspense fallback={<div className="detail-loading"><div className="spinner" /></div>}>
      <GepPageContent />
    </Suspense>
  );
}
