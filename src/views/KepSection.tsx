'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { KepListPage } from './KepListPage';
import { ReleasePage } from './ReleasePage';
import { ReleaseTrackingPage } from './ReleaseTrackingPage';
import { FeatureGatesPage } from './FeatureGatesPage';
import { WhatsNew } from '../components/WhatsNew';
import { TabBar, TabPanel } from '../components/Controls';
import { useKeps, type UseProposalsResult } from '../hooks/useProposals';
import { useRecentChanges } from '../hooks/useRecentChanges';
import { loadRecentKepChanges } from '../api/loaders';
import type { Kep } from '../types/kep';

// The stats tab pulls in Recharts; load it only when the tab is opened.
const KepStats = dynamic(() => import('./StatsPage').then((m) => m.KepStats), {
  loading: () => <div className="detail-loading"><div className="spinner" /></div>,
});

type Tab = 'list' | 'release' | 'tracking' | 'gates' | 'whats-new' | 'stats';

const TABS: { id: Tab; label: string }[] = [
  { id: 'list', label: 'KEPs' },
  { id: 'release', label: 'Release Timeline' },
  { id: 'tracking', label: 'Release Tracking' },
  { id: 'gates', label: 'Feature Gates' },
  { id: 'whats-new', label: "What's New" },
  { id: 'stats', label: 'Stats' },
];

function isValidTab(value: string | null): value is Tab {
  return TABS.some((t) => t.id === value);
}

// Separate component so the git-history requests only run while the tab is open.
function KepWhatsNew({ data }: { data: UseProposalsResult<Kep> }) {
  const { changes, loading } = useRecentChanges(loadRecentKepChanges);
  return <WhatsNew keps={data.items} recentKepChanges={changes} loading={data.loading || loading} />;
}

export function KepSection() {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  // Loaded once here and shared by all tabs so the KEP list is only fetched once.
  const data = useKeps();

  const tabParam = searchParams.get('tab');
  const hasVersionParam = searchParams.get('v') !== null;

  // Determine active tab: use ?tab param if valid, otherwise default to 'release'
  // when a ?v param is present, otherwise 'list'
  const activeTab: Tab = isValidTab(tabParam)
    ? tabParam
    : hasVersionParam
      ? 'release'
      : 'list';

  const handleTabChange = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      // Remove ?v when navigating away from the release tab
      if (tab !== 'release') {
        params.delete('v');
      }
      replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, replace],
  );

  return (
    <div>
      <TabBar tabs={TABS} active={activeTab} onChange={handleTabChange} idPrefix="kep" label="KEP views" />
      <TabPanel idPrefix="kep" active={activeTab}>
        {activeTab === 'list' && <KepListPage data={data} />}
        {activeTab === 'release' && <ReleasePage data={data} />}
        {activeTab === 'tracking' && <ReleaseTrackingPage data={data} />}
        {activeTab === 'gates' && <FeatureGatesPage data={data} />}
        {activeTab === 'whats-new' && <KepWhatsNew data={data} />}
        {activeTab === 'stats' && <KepStats data={data} />}
      </TabPanel>
    </div>
  );
}
