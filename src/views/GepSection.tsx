'use client';

import { useState } from 'react';
import { GepListPage } from './GepListPage';
import { GepStats } from './StatsPage';

type Tab = 'list' | 'stats';

export function GepSection() {
  const [activeTab, setActiveTab] = useState<Tab>('list');

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
      {activeTab === 'stats' && <GepStats />}
    </div>
  );
}
