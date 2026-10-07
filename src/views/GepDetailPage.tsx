'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchGepYaml, fetchGepContent, buildGepPath, fetchGatewayApiPRs, CACHE_KEY_GEPS } from '../api/gatewayapi';
import { readCache, type PRInfo } from '../api/shared';
import type { Gep, GepRelationship } from '../types/gep';
import { GepStatusBadge, BookmarkButton } from '../components/Badges';
import { MetaItem, DetailSection, PeopleSection, PRList, GitHubLink, MarkdownSection } from '../components/Detail';
import { useGepBookmarks } from '../hooks/useBookmarks';
import { useDetailShortcuts } from '../hooks/useKeyboardShortcut';

function getCachedGepNumbers(): string[] {
  return readCache<Gep[]>(CACHE_KEY_GEPS)?.map((g) => String(g.number)) ?? [];
}

function gepHref(number: string): string {
  return `/gep?number=${number}`;
}

export function GepDetailPage({ number }: { number: string }) {
  const [gep, setGep] = useState<Gep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [prs, setPrs] = useState<PRInfo[]>([]);
  const { isBookmarked, toggleBookmark } = useGepBookmarks();

  useDetailShortcuts({ number, getNumbers: getCachedGepNumbers, hrefFor: gepHref, toggleBookmark });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // GEP paths are derived from the number, so fetch directly on a cache miss.
        const data =
          readCache<Gep[]>(CACHE_KEY_GEPS)?.find((g) => String(g.number) === number) ??
          (await fetchGepYaml(buildGepPath(number)));
        if (!cancelled) setGep(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'GEP not found.');
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
    if (!gep) return;
    let cancelled = false;
    fetchGepContent(gep.path).then((c) => {
      if (!cancelled) setContent(c);
    });
    if (gep.changelog && gep.changelog.length > 0) {
      fetchGatewayApiPRs(gep.changelog).then((data) => {
        if (!cancelled) setPrs(data);
      }).catch(() => {
        // PR status is optional
      });
    }
    return () => {
      cancelled = true;
    };
  }, [gep]);

  const onToggleBookmark = useCallback(() => toggleBookmark(number), [toggleBookmark, number]);

  if (loading) {
    return (
      <div className="detail-loading">
        <div className="spinner" />
        <p>Loading GEP-{number}…</p>
      </div>
    );
  }

  if (error || !gep) {
    return (
      <div className="detail-error">
        <p>{error || 'GEP not found'}</p>
        <Link href="/gep" className="back-link">
          ← Back to GEPs
        </Link>
      </div>
    );
  }

  const gepNumber = String(gep.number);

  return (
    <div className="detail-page">
      <div className="detail-back">
        <Link href="/gep" className="back-link">
          ← All GEPs
        </Link>
      </div>

      <div className="detail-header">
        <div className="detail-kep-number">GEP-{gepNumber}</div>
        <h1 className="detail-title">{gep.name}</h1>
        <div className="detail-badges">
          <GepStatusBadge status={gep.status} />
          <BookmarkButton active={isBookmarked(gepNumber)} onToggle={onToggleBookmark} noun="GEP" detail />
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-meta-grid">
          <MetaItem label="Status" value={gep.status} />
          <MetaItem label="Number" value={gepNumber} />
        </div>

        <PeopleSection title="Authors" people={gep.authors} />

        <RelationshipSection title="Obsoletes" relationships={gep.relationships?.obsoletes} />
        <RelationshipSection title="Extends" relationships={gep.relationships?.extends} />
        <RelationshipSection title="See Also" relationships={gep.relationships?.seeAlso} />

        {gep.references && gep.references.length > 0 && (
          <DetailSection title="References">
            <LinkList urls={gep.references} />
          </DetailSection>
        )}

        {gep.changelog && gep.changelog.length > 0 && (
          <DetailSection title="Changelog PRs">
            {prs.length > 0 ? <PRList prs={prs} /> : <LinkList urls={gep.changelog} />}
          </DetailSection>
        )}

        <GitHubLink href={gep.githubUrl} />
      </div>

      {content && <MarkdownSection title="Content" markdown={content} />}
    </div>
  );
}

function RelationshipSection({ title, relationships }: { title: string; relationships?: GepRelationship[] }) {
  if (!relationships || relationships.length === 0) return null;
  return (
    <DetailSection title={title}>
      <ul className="see-also-list">
        {relationships.map((r) => (
          <li key={r.number}>
            <Link href={gepHref(String(r.number))} className="kep-ref-link">
              GEP-{r.number}: {r.name}
            </Link>
            {r.description && (
              <span className="gep-rel-desc"> — {r.description}</span>
            )}
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}

function LinkList({ urls }: { urls: string[] }) {
  return (
    <ul className="see-also-list">
      {urls.map((url) => (
        <li key={url}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="gep-ref-link">
            {url}
          </a>
        </li>
      ))}
    </ul>
  );
}
