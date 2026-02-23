'use client';

import { useEffect, useState } from 'react';
import { getRateLimitInfo, onRateLimitChange } from '../utils/rateLimitStore';
import type { RateLimitInfo } from '../utils/rateLimitStore';

function formatReset(reset: Date | null): string {
  if (!reset) return '';
  const diffMs = reset.getTime() - Date.now();
  if (diffMs <= 0) return 'now';
  const minutes = Math.ceil(diffMs / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  return `in ${hours}h`;
}

export function RateLimitIndicator() {
  const [info, setInfo] = useState<RateLimitInfo>(getRateLimitInfo);

  useEffect(() => {
    // Sync with any updates that happened before the component mounted
    setInfo(getRateLimitInfo());
    return onRateLimitChange(setInfo);
  }, []);

  if (info.remaining === null) return null;

  const pct = info.limit ? info.remaining / info.limit : null;
  const isLow = pct !== null && pct < 0.1;
  const resetLabel = info.isRateLimited ? ` · resets ${formatReset(info.reset)}` : '';
  const title = info.isRateLimited
    ? `GitHub API rate limited — resets ${formatReset(info.reset)}`
    : `GitHub API: ${info.remaining}${info.limit ? `/${info.limit}` : ''} requests remaining`;

  const classes = ['rate-limit-indicator'];
  if (info.isRateLimited) classes.push('rate-limit-indicator--exceeded');
  else if (isLow) classes.push('rate-limit-indicator--low');

  return (
    <span
      className={classes.join(' ')}
      title={title}
      aria-label={title}
    >
      <span className="rate-limit-icon" aria-hidden="true">
        {info.isRateLimited ? '⏱' : '⚡'}
      </span>
      <span className="rate-limit-label">
        {info.isRateLimited
          ? `Rate limited${resetLabel}`
          : `${info.remaining} API calls left`}
      </span>
    </span>
  );
}
