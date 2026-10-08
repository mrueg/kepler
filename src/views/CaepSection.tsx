'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { CaepListPage } from './CaepListPage';
import { WhatsNew } from '../components/WhatsNew';
import { TabBar, TabPanel } from '../components/Controls';
import { useCaeps, type UseProposalsResult } from '../hooks/useProposals';
import { useRecentChanges } from '../hooks/useRecentChanges';
import { loadRecentCaepChanges } from '../api/loaders';
import type { Caep } from '../types/caep';

// The stats tab pulls in Recharts; load it only when the tab is opened.
const CaepStats = dynamic(() => import('./StatsPage').then((m) => m.CaepStats), {
  loading: () => <div className="detail-loading"><div className="spinner" /></div>,
});

type Tab = 'list' | 'whats-new' | 'stats';

const TABS: { id: Tab; label: string }[] = [
  { id: 'list', label: 'CAEPs' },
  { id: 'whats-new', label: "What's New" },
  { id: 'stats', label: 'Stats' },
];

function isValidTab(value: string | null): value is Tab {
  return TABS.some((t) => t.id === value);
}

// Separate component so the git-history requests only run while the tab is open.
function CaepWhatsNew({ data }: { data: UseProposalsResult<Caep> }) {
  const { changes, loading } = useRecentChanges(loadRecentCaepChanges);
  return <WhatsNew caeps={data.items} recentCaepChanges={changes} loading={data.loading || loading} />;
}

export function CaepSection() {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  // Loaded once here and shared by all tabs so the CAEP list is only fetched once.
  const data = useCaeps();

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
      <TabBar tabs={TABS} active={activeTab} onChange={handleTabChange} idPrefix="caep" label="CAEP views" />
      <TabPanel idPrefix="caep" active={activeTab}>
        {activeTab === 'list' && <CaepListPage data={data} />}
        {activeTab === 'whats-new' && <CaepWhatsNew data={data} />}
        {activeTab === 'stats' && <CaepStats data={data} />}
      </TabPanel>
    </div>
  );
}
