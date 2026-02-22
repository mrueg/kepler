export type KepStatus =
  | 'provisional'
  | 'implementable'
  | 'implemented'
  | 'deferred'
  | 'rejected'
  | 'withdrawn'
  | 'replaced';

export type KepStage = 'alpha' | 'beta' | 'stable' | 'pre-alpha';

export interface KepMilestone {
  alpha?: string;
  beta?: string;
  stable?: string;
}

export interface KepMetadata {
  title?: string;
  status?: KepStatus;
  authors?: string[];
  'owning-sig'?: string;
  reviewers?: string[];
  approvers?: string[];
  editor?: string;
  'creation-date'?: string;
  'last-updated'?: string;
  'see-also'?: string[];
  replaces?: string[];
  'superseded-by'?: string[];
  stage?: KepStage;
  milestone?: KepMilestone;
  'participating-sigs'?: string[];
  'latest-milestone'?: string;
  'prr-approvers'?: string[];
}

export interface Kep extends KepMetadata {
  // Path-derived fields
  path: string;
  number: string;
  sig: string;
  slug: string;
  // GitHub URLs
  githubUrl: string;
}
