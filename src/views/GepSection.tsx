'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GepListPage } from './GepListPage';
import { GepStats } from './StatsPage';
import { WhatsNew } from '../components/WhatsNew';
import { useGeps } from '../hooks/useGeps';
import { useRecentGepChanges } from '../hooks/useRecentGepChanges';

type Tab = 'list' | 'whats-new' | 'stats';

const VALID_TABS: Tab[] = ['list', 'whats-new', 'stats'];

function isValidTab(value: string | null): value is Tab {
  return VALID_TABS.includes(value as Tab);
}

export function GepSection() {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const { geps, loading } = useGeps();
  const { changes: recentGepChanges, loading: gitLoading } = useRecentGepChanges();

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
      <div className="stats-tabs" role="tablist">
        <button
          className={`stats-tab${activeTab === 'list' ? ' stats-tab--active' : ''}`}
          onClick={() => handleTabChange('list')}
          role="tab"
          aria-selected={activeTab === 'list'}
          tabIndex={activeTab === 'list' ? 0 : -1}
        >
          GEPs
        </button>
        <button
          className={`stats-tab${activeTab === 'whats-new' ? ' stats-tab--active' : ''}`}
          onClick={() => handleTabChange('whats-new')}
          role="tab"
          aria-selected={activeTab === 'whats-new'}
          tabIndex={activeTab === 'whats-new' ? 0 : -1}
        >
          What&apos;s New
        </button>
        <button
          className={`stats-tab${activeTab === 'stats' ? ' stats-tab--active' : ''}`}
          onClick={() => handleTabChange('stats')}
          role="tab"
          aria-selected={activeTab === 'stats'}
          tabIndex={activeTab === 'stats' ? 0 : -1}
        >
          Stats
        </button>
      </div>
      {activeTab === 'list' && <GepListPage />}
      {activeTab === 'whats-new' && (
        <WhatsNew geps={geps} recentGepChanges={recentGepChanges} loading={loading || gitLoading} />
      )}
      {activeTab === 'stats' && <GepStats />}
    </div>
  );
}
