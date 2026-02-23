import { Suspense } from 'react';
import { KepSection } from '../views/KepSection';

export default function Home() {
  return (
    <Suspense fallback={<div className="list-page" />}>
      <KepSection />
    </Suspense>
  );
}
