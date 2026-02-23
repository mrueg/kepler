'use client';

import { useState } from 'react';
import { GepListPage } from './GepListPage';
import { GepStats } from './StatsPage';
import { WhatsNew } from '../components/WhatsNew';
import { useGeps } from '../hooks/useGeps';
import { useRecentGepChanges } from '../hooks/useRecentGepChanges';

type Tab = 'list' | 'whats-new' | 'stats';

export function GepSection() {
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const { geps, loading } = useGeps();
  const { changes: recentGepChanges, loading: gitLoading } = useRecentGepChanges();

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
          GEPs
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
      {activeTab === 'list' && <GepListPage />}
      {activeTab === 'whats-new' && (
        <WhatsNew geps={geps} recentGepChanges={recentGepChanges} loading={loading || gitLoading} />
      )}
      {activeTab === 'stats' && <GepStats />}
    </div>
  );
}
