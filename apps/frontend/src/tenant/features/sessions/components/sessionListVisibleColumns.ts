import { getVisibleWorkColumns, type ModuleColumnRegistryEntry } from "@mms/shared";

/** Card-face Work columns for Sessions (rendered outside the metadata grid). */
export const SESSION_CARD_FACE_COLUMN_IDS = new Set(["name"]);

/** Visible Work columns in registry order (checkbox / actions stay outside). */
export function getSessionVisibleWorkColumns(
  columnRegistry: ModuleColumnRegistryEntry[],
  isColumnVisible: (key: string) => boolean,
  options?: { excludeFace?: boolean },
): ModuleColumnRegistryEntry[] {
  return getVisibleWorkColumns(columnRegistry, isColumnVisible, {
    excludeFace: options?.excludeFace ? SESSION_CARD_FACE_COLUMN_IDS : undefined,
  });
}
