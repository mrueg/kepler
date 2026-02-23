'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KepListPage } from './KepListPage';
import { ReleasePage } from './ReleasePage';
import { KepStats } from './StatsPage';
import { WhatsNew } from '../components/WhatsNew';
import { useKeps } from '../hooks/useKeps';
import { useRecentKepChanges } from '../hooks/useRecentKepChanges';

type Tab = 'list' | 'release' | 'whats-new' | 'stats';

const VALID_TABS: Tab[] = ['list', 'release', 'whats-new', 'stats'];

function isValidTab(value: string | null): value is Tab {
  return VALID_TABS.includes(value as Tab);
}

export function KepSection() {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const { keps, loading } = useKeps();
  const { changes: recentKepChanges, loading: gitLoading } = useRecentKepChanges();

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
      <div className="stats-tabs" role="tablist">
        <button
          className={`stats-tab${activeTab === 'list' ? ' stats-tab--active' : ''}`}
          onClick={() => handleTabChange('list')}
          role="tab"
          aria-selected={activeTab === 'list'}
          tabIndex={activeTab === 'list' ? 0 : -1}
        >
          KEPs
        </button>
        <button
          className={`stats-tab${activeTab === 'release' ? ' stats-tab--active' : ''}`}
          onClick={() => handleTabChange('release')}
          role="tab"
          aria-selected={activeTab === 'release'}
          tabIndex={activeTab === 'release' ? 0 : -1}
        >
          Release Timeline
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
      {activeTab === 'list' && <KepListPage />}
      {activeTab === 'release' && <ReleasePage />}
      {activeTab === 'whats-new' && (
        <WhatsNew keps={keps} recentKepChanges={recentKepChanges} loading={loading || gitLoading} />
      )}
      {activeTab === 'stats' && <KepStats />}
    </div>
  );
}
