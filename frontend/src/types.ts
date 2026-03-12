export interface LabelDefinition {
  id: string;
  name: string;
  prompt: string;
}

export type CategorizedChangeType = 'added' | 'removed' | 'modified' | 'absent';

export interface CategorizedChange {
  type: CategorizedChangeType;
  /** Etiqueta breve (compatibilidad) */
  label?: string;
  /** Campo o área afectada (ej: "Fecha de vencimiento") */
  field?: string;
  oldValue?: string;
  newValue?: string;
  /** Descripción del cambio */
  description?: string;
  /** Nombre del área de comparación cuando se usan pares */
  areaName?: string;
}

export interface ComparisonResult {
  textualDifferences: string;
  visualDifferences: {
    box_2d: [number, number, number, number];
    label: string;
    areaName?: string;
  }[];
  categorizedChanges?: CategorizedChange[];
}

export interface ComparisonPair {
  id: string;
  name: string;
  region1: [number, number, number, number] | null;
  region2: [number, number, number, number] | null;
  prompt?: string;
}

export interface FileData {
  name: string;
  type: string;
  base64: string;
  previewUrl: string;
  totalPages?: number;
  arrayBuffer?: ArrayBuffer;
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
