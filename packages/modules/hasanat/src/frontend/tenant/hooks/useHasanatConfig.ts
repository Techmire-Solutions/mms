import { useHasanatHost } from "../host.js";

/** Structural shape of the app's hasanat field-config surface used by the module UI. */
export interface HasanatConfigField {
  id: string;
  [key: string]: unknown;
}

export interface HasanatConfigResult {
  fields: Record<string, { required?: boolean; [key: string]: unknown }>;
  orderedFields: HasanatConfigField[];
  isFieldEnabled: (id: string) => boolean;
  isFieldRequired: (field: unknown) => boolean;
  [key: string]: unknown;
}

export function useHasanatConfig(): HasanatConfigResult {
  return useHasanatHost().useHasanatConfig() as HasanatConfigResult;
}
