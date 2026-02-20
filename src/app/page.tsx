import { Suspense } from 'react';
import { KepListPage } from '../views/KepListPage';

export default function Home() {
  return (
    <Suspense fallback={<div className="list-page" />}>
      <KepListPage />
    </Suspense>
  );
}
