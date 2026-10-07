'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchKepYaml, fetchKepReadme, findKepPath, fetchEnhancementPRs, CACHE_KEY_KEPS } from '../api/github';
import { readCache, type PRInfo } from '../api/shared';
import type { Kep } from '../types/kep';
import { StatusBadge, StageBadge, StaleBadge, BookmarkButton } from '../components/Badges';
import { MetaItem, DetailSection, PeopleSection, PRList, GitHubLink, MarkdownSection } from '../components/Detail';
import { MilestoneTimeline } from '../components/MilestoneTimeline';
import { isStale, formatSig } from '../utils/kep';
import { useKepBookmarks } from '../hooks/useBookmarks';
import { useDetailShortcuts } from '../hooks/useKeyboardShortcut';

function getCachedKepNumbers(): string[] {
  return readCache<Kep[]>(CACHE_KEY_KEPS)?.map((k) => k.number) ?? [];
}

function kepHref(number: string): string {
  return `/kep?number=${number}`;
}

export function KepDetailPage({ number }: { number: string }) {
  const [kep, setKep] = useState<Kep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readme, setReadme] = useState<string | null>(null);
  const [prs, setPrs] = useState<PRInfo[]>([]);
  const { isBookmarked, toggleBookmark } = useKepBookmarks();

  useDetailShortcuts({ number, getNumbers: getCachedKepNumbers, hrefFor: kepHref, toggleBookmark });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let data = readCache<Kep[]>(CACHE_KEY_KEPS)?.find((k) => k.number === number);
        if (!data) {
          // Not in the list cache (e.g. a shared link on a first visit):
          // resolve the path from the repo tree and fetch just this KEP.
          const path = await findKepPath(number);
          if (!path) throw new Error(`KEP-${number} not found.`);
          data = await fetchKepYaml(path);
        }
        if (!cancelled) setKep(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load KEP');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [number]);

  useEffect(() => {
    if (!kep) return;
    let cancelled = false;
    fetchKepReadme(kep.path).then((content) => {
      if (!cancelled) setReadme(content);
    });
    fetchEnhancementPRs(kep.number).then((data) => {
      if (!cancelled) setPrs(data);
    });
    return () => {
      cancelled = true;
    };
  }, [kep]);

  const onToggleBookmark = useCallback(() => toggleBookmark(number), [toggleBookmark, number]);

  if (loading) {
    return (
      <div className="detail-loading">
        <div className="spinner" />
        <p>Loading KEP-{number}…</p>
      </div>
    );
  }

  if (error || !kep) {
    return (
      <div className="detail-error">
        <p>{error || 'KEP not found'}</p>
        <Link href="/" className="back-link">
          ← Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <div className="detail-back">
        <Link href="/" className="back-link">
          ← All KEPs
        </Link>
      </div>

      <div className="detail-header">
        <div className="detail-kep-number">KEP-{kep.number}</div>
        <h1 className="detail-title">{kep.title}</h1>
        <div className="detail-badges">
          <StatusBadge status={kep.status} />
          <StageBadge stage={kep.stage} />
          {isStale(kep) && <StaleBadge />}
          <BookmarkButton active={isBookmarked(kep.number)} onToggle={onToggleBookmark} noun="KEP" detail />
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-meta-grid">
          <MetaItem label="SIG" value={kep.sig && formatSig(kep.sig)} />
          <MetaItem label="Status" value={kep.status} />
          <MetaItem label="Stage" value={kep.stage} />
          <MetaItem label="Created" value={kep['creation-date']} />
          <MetaItem label="Last updated" value={kep['last-updated']} />
          <MetaItem label="Latest milestone" value={kep['latest-milestone']} />
        </div>

        <PeopleSection title="Authors" people={kep.authors} />
        <PeopleSection title="Reviewers" people={kep.reviewers} />
        <PeopleSection title="Approvers" people={kep.approvers} />
        <PeopleSection title="PRR Approvers" people={kep['prr-approvers']} />

        {kep.milestone && Object.keys(kep.milestone).length > 0 && (
          <DetailSection title="Milestones">
            <MilestoneTimeline milestone={kep.milestone} stage={kep.stage} />
          </DetailSection>
        )}

        {kep['participating-sigs'] && kep['participating-sigs'].length > 0 && (
          <DetailSection title="Participating SIGs">
            <p>{kep['participating-sigs'].join(', ')}</p>
          </DetailSection>
        )}

        <KepRefSection title="See Also" refs={kep['see-also']} />
        <KepRefSection title="Replaces" refs={kep.replaces} />
        <KepRefSection title="Superseded By" refs={kep['superseded-by']} />

        {prs.length > 0 && (
          <DetailSection title="Enhancement PRs">
            <PRList prs={prs} />
          </DetailSection>
        )}

        <GitHubLink href={kep.githubUrl} />
      </div>

      {readme && <MarkdownSection title="README" markdown={readme} githubDirUrl={kep.githubUrl} />}
    </div>
  );
}

function KepRefSection({ title, refs }: { title: string; refs?: string[] }) {
  if (!refs || refs.length === 0) return null;
  return (
    <DetailSection title={title}>
      <ul className="see-also-list">
        {refs.map((ref) => (
          <li key={ref}><KepRef value={ref} /></li>
        ))}
      </ul>
    </DetailSection>
  );
}

function extractKepNumber(ref: string): string | null {
  // Match plain number: "1234"
  if (/^\d+$/.test(ref.trim())) return ref.trim();
  // Match "kep-1234" or "KEP-1234"
  const kepPrefix = ref.match(/^kep-(\d+)/i);
  if (kepPrefix) return kepPrefix[1];
  // Match path like "/keps/sig-xxx/1234-slug/..." or "keps/sig-xxx/1234-slug/..."
  const pathMatch = ref.match(/(?:^|\/)(\d+)-[^/]+/);
  if (pathMatch) return pathMatch[1];
  return null;
}

function KepRef({ value }: { value: string }) {
  const number = extractKepNumber(value);
  const [cachedKep] = useState<Kep | null>(() => {
    if (!number || typeof window === 'undefined') return null;
    return readCache<Kep[]>(CACHE_KEY_KEPS)?.find((k) => k.number === number) ?? null;
  });

  if (number) {
    return (
      <span className="kep-ref-item">
        <Link href={`/kep?number=${number}`} className="kep-ref-link">
          KEP-{number}{cachedKep?.title ? `: ${cachedKep.title}` : ''}
        </Link>
        {cachedKep?.status && (
          <StatusBadge status={cachedKep.status} />
        )}
        {cachedKep?.stage && (
          <StageBadge stage={cachedKep.stage} />
        )}
      </span>
    );
  }
  if (/^https?:\/\//.test(value)) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="kep-ref-link">
        {value}
      </a>
    );
  }
  return <>{value}</>;
}
