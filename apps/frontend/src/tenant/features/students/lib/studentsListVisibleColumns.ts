import {
  getVisibleWorkColumns,
  STUDENT_CARD_FACE_COLUMN_IDS,
  STUDENT_SORT_FIELDS,
  type ModuleColumnRegistryEntry,
} from "@mms/shared";
import type { StudentsListContentSortField } from "@/tenant/features/students/lib/studentsListTypes";

/** Sortable Work columns that map to the Students list API allowlist. */
const STUDENT_LIST_SORTABLE_FIELDS = new Set<StudentsListContentSortField>(STUDENT_SORT_FIELDS);

/** Visible Work columns in registry order (checkbox / actions stay outside). */
export function getStudentVisibleWorkColumns(
  columnRegistry: ModuleColumnRegistryEntry[],
  isColumnVisible: (key: string) => boolean,
  options?: { excludeFace?: boolean },
): ModuleColumnRegistryEntry[] {
  return getVisibleWorkColumns(columnRegistry, isColumnVisible, {
    excludeFace: options?.excludeFace ? STUDENT_CARD_FACE_COLUMN_IDS : undefined,
  });
}

export function toStudentsListContentSortField(
  columnKey: string,
): StudentsListContentSortField | null {
  if (STUDENT_LIST_SORTABLE_FIELDS.has(columnKey as StudentsListContentSortField)) {
    return columnKey as StudentsListContentSortField;
  }
  return null;
}
