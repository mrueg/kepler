'use client';

import { useState } from 'react';
import { KepListPage } from './KepListPage';
import { ReleasePage } from './ReleasePage';

type Tab = 'list' | 'release';

export function KepSection() {
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
      </div>
      {activeTab === 'list' ? <KepListPage /> : <ReleasePage />}
    </div>
  );
}
