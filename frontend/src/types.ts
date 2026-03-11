export interface LabelDefinition {
  id: string;
  name: string;
  prompt: string;
}

export type CategorizedChangeType = 'added' | 'removed' | 'modified' | 'absent';

export interface CategorizedChange {
  type: CategorizedChangeType;
  label: string;
}

export interface ComparisonResult {
  textualDifferences: string;
  visualDifferences: {
    box_2d: [number, number, number, number];
    label: string;
  }[];
  categorizedChanges?: CategorizedChange[];
}

export interface FileData {
  name: string;
  type: string;
  base64: string;
  previewUrl: string;
}

export interface CatalogItem {
  id: number;
  name: string;
  version?: string;
  client?: string;
  metadata_json?: string;
  reference_blob_path?: string;
  new_version_blob_path?: string;
  instructions?: string;
  created_at: string;
  updated_at: string;
}

export type Role = 'admin' | 'user' | 'viewer';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}
