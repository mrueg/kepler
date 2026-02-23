'use client';

import { useState } from 'react';
import { KepListPage } from './KepListPage';
import { ReleasePage } from './ReleasePage';
import { KepStats } from './StatsPage';
import { WhatsNew } from '../components/WhatsNew';
import { useKeps } from '../hooks/useKeps';
import { useRecentKepChanges } from '../hooks/useRecentKepChanges';

type Tab = 'list' | 'release' | 'whats-new' | 'stats';

export function KepSection() {
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const { keps, loading } = useKeps();
  const { changes: recentKepChanges, loading: gitLoading } = useRecentKepChanges();

  return (
    <div>
      <div className="stats-tabs" role="tablist">
        <button
          className={`stats-tab${activeTab === 'list' ? ' stats-tab--active' : ''}`}
          onClick={() => setActiveTab('list')}
          role="tab"
          aria-selected={activeTab === 'list'}
          tabIndex={activeTab === 'list' ? 0 : -1}
        >
          KEPs
        </button>
        <button
          className={`stats-tab${activeTab === 'release' ? ' stats-tab--active' : ''}`}
          onClick={() => setActiveTab('release')}
          role="tab"
          aria-selected={activeTab === 'release'}
          tabIndex={activeTab === 'release' ? 0 : -1}
        >
          Release Timeline
        </button>
        <button
          className={`stats-tab${activeTab === 'whats-new' ? ' stats-tab--active' : ''}`}
          onClick={() => setActiveTab('whats-new')}
          role="tab"
          aria-selected={activeTab === 'whats-new'}
          tabIndex={activeTab === 'whats-new' ? 0 : -1}
        >
          What&apos;s New
        </button>
        <button
          className={`stats-tab${activeTab === 'stats' ? ' stats-tab--active' : ''}`}
          onClick={() => setActiveTab('stats')}
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
