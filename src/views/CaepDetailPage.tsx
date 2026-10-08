'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CACHE_KEY_CAEPS, caepHref, caepIdFromReference, fetchCaep, findCaepPath } from '../api/clusterapi';
import { readCache } from '../api/shared';
import type { Caep } from '../types/caep';
import { ArchivedBadge, BookmarkButton, CaepStatusBadge } from '../components/Badges';
import { DetailSection, GitHubLink, MarkdownSection, MetaItem, PeopleSection } from '../components/Detail';
import { useCaepBookmarks } from '../hooks/useBookmarks';
import { useDetailShortcuts } from '../hooks/useKeyboardShortcut';

function cachedCaeps(): Caep[] {
  return readCache<Caep[]>(CACHE_KEY_CAEPS) ?? [];
}

// Ids start with their YYYYMMDD date, so arrow keys move through them chronologically.
function getCachedCaepIds(): string[] {
  return cachedCaeps().map((c) => c.id);
}

function CaepRef({ value }: { value: string }) {
  const id = caepIdFromReference(value);
  if (id) {
    const title = cachedCaeps().find((c) => c.id === id)?.title;
    return (
      <Link href={caepHref(id)} className="kep-ref-link">
        {title ?? id}
      </Link>
    );
  }
  if (/^https?:\/\//.test(value)) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="gep-ref-link">
        {value}
      </a>
    );
  }
  return <>{value}</>;
}

function CaepRefSection({ title, refs }: { title: string; refs?: string[] }) {
  if (!refs || refs.length === 0) return null;
  return (
    <DetailSection title={title}>
      <ul className="see-also-list">
        {refs.map((ref) => (
          <li key={ref}>
            <CaepRef value={ref} />
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}

export function CaepDetailPage({ id }: { id: string }) {
  const [caep, setCaep] = useState<Caep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isBookmarked, toggleBookmark } = useCaepBookmarks();

  useDetailShortcuts({ number: id, getNumbers: getCachedCaepIds, hrefFor: caepHref, toggleBookmark });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // The list cache has no body text, so always fetch the file itself
        // (a raw.githubusercontent.com request, not a GitHub API call).
        const path = cachedCaeps().find((c) => c.id === id)?.path ?? (await findCaepPath(id));
        if (!path) throw new Error('CAEP not found.');
        const data = await fetchCaep(path);
        if (!cancelled) setCaep(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load CAEP');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onToggleBookmark = useCallback(() => toggleBookmark(id), [toggleBookmark, id]);

  if (error) {
    return (
      <div className="detail-error">
        <p>{error}</p>
        <Link href="/caep" className="back-link">
          ← Back to CAEPs
        </Link>
      </div>
    );
  }

  if (!caep) {
    return (
      <div className="detail-loading">
        <div className="spinner" />
        <p>Loading CAEP…</p>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <div className="detail-back">
        <Link href="/caep" className="back-link">
          ← All CAEPs
        </Link>
      </div>

      <div className="detail-header">
        <div className="detail-kep-number">CAEP · {caep.date}</div>
        <h1 className="detail-title">{caep.title}</h1>
        <div className="detail-badges">
          <CaepStatusBadge status={caep.status} />
          {caep.archived && <ArchivedBadge />}
          <BookmarkButton active={isBookmarked(caep.id)} onToggle={onToggleBookmark} noun="CAEP" detail />
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-meta-grid">
          <MetaItem label="Status" value={caep.status} />
          <MetaItem label="Created" value={caep['creation-date'] ?? caep.date} />
          <MetaItem label="Last updated" value={caep['last-updated']} />
          <MetaItem label="File" value={caep.path.replace(/^docs\/proposals\//, '')} />
        </div>

        <PeopleSection title="Authors" people={caep.authors} />
        <PeopleSection title="Reviewers" people={caep.reviewers} />

        <CaepRefSection title="See Also" refs={caep['see-also']} />
        <CaepRefSection title="Replaces" refs={caep.replaces} />
        <CaepRefSection title="Superseded By" refs={caep['superseded-by']} />

        <GitHubLink href={caep.githubUrl} />
      </div>

      {caep.content && <MarkdownSection title="Proposal" markdown={caep.content} githubDirUrl={caep.githubDirUrl} />}
    </div>
  );
}
