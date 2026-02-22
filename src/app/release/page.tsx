import { Suspense } from 'react';
import { ReleasePage } from '../../views/ReleasePage';

export default function Release() {
  return (
    <Suspense fallback={<div className="release-page" />}>
      <ReleasePage />
    </Suspense>
  );
}
