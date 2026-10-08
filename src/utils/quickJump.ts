export type ProposalKind = 'KEP' | 'GEP';

export interface JumpTarget {
  kind: ProposalKind;
  number: string;
  title: string;
  href: string;
}

export function proposalHref(kind: ProposalKind, number: string): string {
  return kind === 'KEP' ? `/kep?number=${number}` : `/gep?number=${number}`;
}

// "753", "#753", "kep 753", "KEP-753", "gep-1234"
const NUMBER_QUERY = /^(?:(kep|gep)[\s#-]*)?#?(\d+)$/i;

/**
 * Ranks proposals for the quick-jump box. Numbers match exactly first, then by
 * prefix; text matches titles (title start > word start > anywhere), newer
 * proposals first within a rank. A number not in `targets` (e.g. the lists
 * haven't loaded yet) still yields a direct link, since detail pages can fetch
 * a proposal on their own.
 */
export function searchJumpTargets(query: string, targets: JumpTarget[], limit = 8): JumpTarget[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const numeric = q.match(NUMBER_QUERY);
  if (numeric) {
    const kind = numeric[1]?.toUpperCase() as ProposalKind | undefined;
    const number = numeric[2].replace(/^0+(?=\d)/, '');
    const candidates = targets.filter((t) => !kind || t.kind === kind);
    const exact = candidates.filter((t) => t.number === number);
    const prefix = candidates
      .filter((t) => t.number !== number && t.number.startsWith(number))
      .sort((a, b) => Number(a.number) - Number(b.number));
    // Without an exact match, still link to the number directly; bare numbers
    // are assumed to be KEPs, which are far more numerous.
    const directKind = kind ?? 'KEP';
    const direct = exact.some((t) => t.kind === directKind)
      ? []
      : [{ kind: directKind, number, title: '', href: proposalHref(directKind, number) }];
    return [...exact, ...direct, ...prefix].slice(0, limit);
  }

  const rank = (title: string): number => {
    const t = title.toLowerCase();
    if (t.startsWith(q)) return 0;
    if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) return 1;
    if (t.includes(q)) return 2;
    return -1;
  };
  return targets
    .map((t) => ({ t, r: rank(t.title) }))
    .filter(({ r }) => r >= 0)
    .sort((a, b) => a.r - b.r || Number(b.t.number) - Number(a.t.number))
    .slice(0, limit)
    .map(({ t }) => t);
}
