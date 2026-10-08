'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { GepListPage } from './GepListPage';
import { WhatsNew } from '../components/WhatsNew';
import { TabBar } from '../components/Controls';
import { useGeps, type UseProposalsResult } from '../hooks/useProposals';
import { useRecentChanges } from '../hooks/useRecentChanges';
import { fetchRecentlyChangedGeps } from '../api/gatewayapi';
import type { Gep } from '../types/gep';

// The stats tab pulls in Recharts; load it only when the tab is opened.
const GepStats = dynamic(() => import('./StatsPage').then((m) => m.GepStats), {
  loading: () => <div className="detail-loading"><div className="spinner" /></div>,
});

type Tab = 'list' | 'whats-new' | 'stats';

const TABS: { id: Tab; label: string }[] = [
  { id: 'list', label: 'GEPs' },
  { id: 'whats-new', label: "What's New" },
  { id: 'stats', label: 'Stats' },
];

function isValidTab(value: string | null): value is Tab {
  return TABS.some((t) => t.id === value);
}

// Separate component so the git-history requests only run while the tab is open.
function GepWhatsNew({ data }: { data: UseProposalsResult<Gep> }) {
  const { changes, loading } = useRecentChanges(fetchRecentlyChangedGeps);
  return <WhatsNew geps={data.items} recentGepChanges={changes} loading={data.loading || loading} />;
}

export function GepSection() {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  // Loaded once here and shared by all tabs so the GEP list is only fetched once.
  const data = useGeps();

  const tabParam = searchParams.get('tab');
  const activeTab: Tab = isValidTab(tabParam) ? tabParam : 'list';

  const handleTabChange = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, replace],
  );

  return (
    <div>
      <TabBar tabs={TABS} active={activeTab} onChange={handleTabChange} />
      {activeTab === 'list' && <GepListPage data={data} />}
      {activeTab === 'whats-new' && <GepWhatsNew data={data} />}
      {activeTab === 'stats' && <GepStats data={data} />}
    </div>
  );
}
