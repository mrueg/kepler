export type CaepStatus =
  | 'provisional'
  | 'experimental'
  | 'implementable'
  | 'implemented'
  | 'deferred'
  | 'rejected'
  | 'withdrawn'
  | 'replaced';

/** Front matter of a Cluster API Enhancement Proposal (docs/proposals/*.md). */
export interface CaepMetadata {
  title?: string;
  status?: CaepStatus;
  authors?: string[];
  reviewers?: string[];
  'creation-date'?: string;
  'last-updated'?: string;
  'see-also'?: string[];
  replaces?: string[];
  'superseded-by'?: string[];
}

export interface Caep extends CaepMetadata {
  /** File name without .md, e.g. "20191017-kubeadm-based-control-plane"; CAEPs have no numbers. */
  id: string;
  title: string;
  /** YYYY-MM-DD from the file name. */
  date: string;
  /** Moved to docs/proposals/archived. */
  archived: boolean;
  path: string;
  /** The file on GitHub. */
  githubUrl: string;
  /** GitHub tree URL of the folder, for resolving relative links in the body. */
  githubDirUrl: string;
  /** Markdown body without front matter (not cached). */
  content?: string;
}
