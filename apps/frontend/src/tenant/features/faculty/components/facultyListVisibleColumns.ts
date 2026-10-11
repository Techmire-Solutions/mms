import {
  customFieldKeyFromColumnKey,
  getVisibleWorkColumns,
  FACULTY_CARD_FACE_COLUMN_IDS,
  FACULTY_SORT_FIELD_SET,
  type ModuleColumnRegistryEntry,
  type FacultyCustomField,
  type FacultySortField,
} from "@mms/shared";

/** Visible Work columns in registry order (checkbox / actions stay outside). */
export function getFacultyVisibleWorkColumns(
  columnRegistry: ModuleColumnRegistryEntry[],
  isColumnVisible: (key: string) => boolean,
  options?: { excludeFace?: boolean },
): ModuleColumnRegistryEntry[] {
  return getVisibleWorkColumns(columnRegistry, isColumnVisible, {
    excludeFace: options?.excludeFace ? FACULTY_CARD_FACE_COLUMN_IDS : undefined,
  });
}

/** Map a Work column key to the faculty list SQL sort allowlist. */
export function toFacultyListSortField(columnKey: string): FacultySortField | null {
  if (FACULTY_SORT_FIELD_SET.has(columnKey)) {
    return columnKey as FacultySortField;
  }
  return null;
}

/** Build custom-field id → label map from Work column registry `custom:*` keys. */
export function buildFacultyCustomFieldsById(
  columnRegistry: ModuleColumnRegistryEntry[],
): Map<string, FacultyCustomField> {
  const map = new Map<string, FacultyCustomField>();
  for (const col of columnRegistry) {
    const fieldId = customFieldKeyFromColumnKey(col.key);
    if (fieldId === null) continue;
    map.set(fieldId, { id: fieldId, label: col.label });
  }
  return map;
}

/** Responsive breakpoint utility for a Work column (shared by head + cell). */
function facultyWorkColumnBreakpointClass(columnKey: string): string {
  if (columnKey === "designation" || columnKey === "department" || columnKey === "employeeId") {
    return "hidden sm:table-cell";
  }
  if (
    columnKey === "qualification" ||
    columnKey === "specialization" ||
    columnKey === "joinDate" ||
    columnKey === "employmentStartDate" ||
    columnKey === "employmentEndDate" ||
    columnKey === "designationStartDate" ||
    columnKey === "designationEndDate" ||
    columnKey === "employDesignationStatus" ||
    columnKey === "performanceRating" ||
    columnKey === "notes"
  ) {
    return "hidden md:table-cell";
  }
  if (customFieldKeyFromColumnKey(columnKey) !== null) {
    return "hidden lg:table-cell";
  }
  return "";
}

/** Responsive table-cell visibility classes for Work columns (value text renders in foreground). */
export function facultyWorkColumnCellClass(columnKey: string): string {
  const breakpoint = facultyWorkColumnBreakpointClass(columnKey);
  return ["px-4 py-3", breakpoint].filter(Boolean).join(" ");
}

export function facultyWorkColumnHeadClass(columnKey: string): string {
  const breakpoint = facultyWorkColumnBreakpointClass(columnKey);
  return ["px-4 py-3 text-start", breakpoint].filter(Boolean).join(" ");
}
