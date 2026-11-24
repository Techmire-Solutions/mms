import type { AppTranslationKey } from "../i18n/appTranslations.js";
import type { ColumnRegistryEntry } from "../contacts/contactFieldSchemaTypes.js";
import { FACULTY_DIRECTORY_COLUMN_SURFACES } from "./facultyDirectoryColumnSurfaces.js";

export { FACULTY_DIRECTORY_COLUMN_SURFACES };

export interface FacultyWorkColumnLabels {
  name: string;
  employeeId: string;
  designation: string;
  department: string;
  employDesignationStatus: string;
  designationStartDate: string;
  designationEndDate: string;
  status: string;
  employmentStartDate: string;
  employmentEndDate: string;
  specialization: string;
  qualification: string;
  notes: string;
  performanceRating: string;
}

export type FacultyDirectoryColumnKey = (typeof FACULTY_DIRECTORY_COLUMN_SURFACES)[number]["key"];

export const FACULTY_WORK_COLUMN_KEYS = [
  "employeeId",
  "designation",
  "department",
  "employDesignationStatus",
  "designationStartDate",
  "designationEndDate",
  "status",
  "employmentStartDate",
  "employmentEndDate",
  "specialization",
  "qualification",
  "notes",
  "performanceRating",
] as const;

export type FacultyWorkColumnKey = (typeof FACULTY_WORK_COLUMN_KEYS)[number];

/** Builds Work column labels (`name` + {@link FACULTY_WORK_COLUMN_KEYS}). */
export function facultyWorkColumnLabelsFrom(
  resolveLabel: (key: string) => string,
): FacultyWorkColumnLabels {
  const keys = ["name", ...FACULTY_WORK_COLUMN_KEYS] as const;
  const labels = {} as FacultyWorkColumnLabels;
  for (const key of keys) {
    labels[key as keyof FacultyWorkColumnLabels] = resolveLabel(key);
  }
  return labels;
}

/** Default Work column registry (before tenant Fields sync / user overlay). */
export const DEFAULT_FACULTY_COLUMN_REGISTRY: ColumnRegistryEntry[] =
  FACULTY_DIRECTORY_COLUMN_SURFACES.filter((surface) => surface.work)
    .slice()
    .sort((left, right) => left.workOrder - right.workOrder)
    .map((surface) => ({
      key: surface.key,
      label: surface.label,
      ...(surface.labelKey ? { labelKey: surface.labelKey } : {}),
      enabled: true,
      order: surface.workOrder,
      sortable: surface.sortable,
      width: surface.width,
      fixed: surface.fixed || undefined,
    }));

/** Face chrome on Faculty Work cards — excluded from metadata tile grid. */
export const FACULTY_CARD_FACE_COLUMN_IDS = new Set(
  FACULTY_DIRECTORY_COLUMN_SURFACES.filter((surface) => surface.fixed && surface.work).map(
    (surface) => surface.key,
  ),
);

/** Maps Work column keys to Setup Fields for enablement sync + field-removal deps. */
export const FACULTY_COLUMN_FIELD_MAPPING: Record<
  FacultyWorkColumnKey,
  { tabId: string; fieldId: string }
> = (() => {
  const mapping = {} as Record<FacultyWorkColumnKey, { tabId: string; fieldId: string }>;
  for (const surface of FACULTY_DIRECTORY_COLUMN_SURFACES) {
    if (!surface.work || !("mapping" in surface) || !surface.mapping) continue;
    mapping[surface.key as FacultyWorkColumnKey] = {
      tabId: surface.mapping.tabId,
      fieldId: surface.mapping.fieldId,
    };
  }
  return mapping;
})();

/** Work-list / SQL sort keys for faculty (FE + BE SSOT). */
export const FACULTY_SORT_FIELDS = [
  "name",
  "employeeId",
  "department",
  "designation",
  "specialization",
  "qualification",
  "status",
  "profileStatus",
  "employDesignationStatus",
  "employmentStartDate",
  "employmentEndDate",
  "designationStartDate",
  "designationEndDate",
  "performanceRating",
  "updatedAt",
] as const;

export type FacultySortField = (typeof FACULTY_SORT_FIELDS)[number];
export const FACULTY_SORT_FIELD_SET: ReadonlySet<string> = new Set(FACULTY_SORT_FIELDS);

/** Default CSV export columns (English labels; FE may re-label via `t()`). */
export const DEFAULT_FACULTY_EXPORT_COLUMNS = FACULTY_DIRECTORY_COLUMN_SURFACES.filter(
  (surface) => surface.export,
)
  .slice()
  .sort((left, right) => left.exportOrder - right.exportOrder)
  .map((surface) => ({
    id: surface.key,
    label: surface.exportLabel,
  }));

const FACULTY_DIRECTORY_COLUMN_SURFACES_BY_KEY = new Map<
  string,
  (typeof FACULTY_DIRECTORY_COLUMN_SURFACES)[number]
>(FACULTY_DIRECTORY_COLUMN_SURFACES.map((item) => [item.key, item]));

/** Translation key for a Faculty field label (`faculty.field.${fieldKey}` fallback). */
export function facultyFieldLabelKey(fieldKey: string): AppTranslationKey {
  return `faculty.field.${fieldKey}` as AppTranslationKey;
}

/** Translation key for a Faculty column label (surface `labelKey`, else {@link facultyFieldLabelKey}). */
export function facultyColumnLabelKey(columnKey: string): AppTranslationKey {
  const surface = FACULTY_DIRECTORY_COLUMN_SURFACES_BY_KEY.get(columnKey);
  return surface?.labelKey ?? facultyFieldLabelKey(columnKey);
}
