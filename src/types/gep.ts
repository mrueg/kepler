export type GepStatus =
  | 'Memorandum'
  | 'Provisional'
  | 'Experimental'
  | 'Standard'
  | 'Declined'
  | 'Deferred'
  | 'Withdrawn';

export interface GepRelationship {
  name: string;
  number: number;
  description?: string;
}

export interface GepRelationships {
  extends?: GepRelationship[];
  obsoletes?: GepRelationship[];
  seeAlso?: GepRelationship[];
}

export interface GepMetadata {
  apiVersion?: string;
  kind?: string;
  number: number;
  name: string;
  status: GepStatus;
  authors?: string[];
  relationships?: GepRelationships;
  references?: string[];
  changelog?: string[];
}

export interface Gep extends GepMetadata {
  path: string;
  githubUrl: string;
}
