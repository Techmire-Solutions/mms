import { getVisibleWorkColumns, type ModuleColumnRegistryEntry } from "@mms/shared";

/** Card-face Work columns for Enrollments (rendered outside the metadata grid). */
export const ENROLLMENT_CARD_FACE_COLUMN_IDS = new Set(["student"]);

/** Visible Work columns in registry order (checkbox / actions stay outside). */
export function getEnrollmentVisibleWorkColumns(
  columnRegistry: ModuleColumnRegistryEntry[],
  isColumnVisible: (key: string) => boolean,
  options?: { excludeFace?: boolean },
): ModuleColumnRegistryEntry[] {
  return getVisibleWorkColumns(columnRegistry, isColumnVisible, {
    excludeFace: options?.excludeFace ? ENROLLMENT_CARD_FACE_COLUMN_IDS : undefined,
  });
}
