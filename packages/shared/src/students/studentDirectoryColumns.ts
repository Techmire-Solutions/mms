import type { AppTranslationKey } from "../i18n/appTranslations.js";
import type { ColumnRegistryEntry } from "../contacts/contactFieldSchemaTypes.js";
import type { StudentWorkColumnLabels } from "../settings/moduleColumnCore.js";

export const STUDENT_DIRECTORY_COLUMN_SURFACES = [
  {
    key: "name",
    work: true,
    sort: true,
    export: true,
    fixed: true,
    workOrder: 0,
    sortOrder: 0,
    exportOrder: 0,
    label: "Name",
    labelKey: "students.columns.name" as AppTranslationKey,
    exportLabel: "Name",
    width: 200,
    sortable: true,
  },
  {
    key: "grNumber",
    work: true,
    sort: true,
    export: true,
    fixed: true,
    workOrder: 1,
    sortOrder: 1,
    exportOrder: 1,
    label: "GR Number",
    labelKey: "students.columns.grNumber" as AppTranslationKey,
    exportLabel: "GR Number",
    width: 110,
    sortable: true,
    mapping: { tabId: "registration", fieldId: "grNumber" },
  },
  {
    key: "gender",
    work: true,
    sort: true,
    export: true,
    fixed: false,
    workOrder: 2,
    sortOrder: 3,
    exportOrder: 2,
    label: "Gender",
    labelKey: "students.columns.gender" as AppTranslationKey,
    exportLabel: "Gender",
    width: 100,
    sortable: true,
    mapping: { tabId: "basic", fieldId: "gender" },
  },
  {
    key: "phone",
    work: true,
    sort: false,
    export: true,
    fixed: false,
    workOrder: 3,
    sortOrder: -1,
    exportOrder: 3,
    label: "Phone",
    labelKey: "students.columns.phone" as AppTranslationKey,
    exportLabel: "Phone",
    width: 140,
    sortable: false,
  },
  {
    key: "email",
    work: true,
    sort: false,
    export: true,
    fixed: false,
    workOrder: 4,
    sortOrder: -1,
    exportOrder: 4,
    label: "Email",
    labelKey: "students.columns.email" as AppTranslationKey,
    exportLabel: "Email",
    width: 180,
    sortable: false,
  },
  {
    key: "dob",
    work: true,
    sort: true,
    export: true,
    fixed: false,
    workOrder: 5,
    sortOrder: 5,
    exportOrder: 5,
    label: "Date of Birth",
    labelKey: "students.columns.dob" as AppTranslationKey,
    exportLabel: "Date of Birth",
    width: 120,
    sortable: true,
    mapping: { tabId: "basic", fieldId: "dob" },
  },
  {
    key: "parents",
    work: true,
    sort: false,
    export: true,
    fixed: false,
    workOrder: 6,
    sortOrder: -1,
    exportOrder: 6,
    label: "Parents",
    labelKey: "students.columns.parents" as AppTranslationKey,
    exportLabel: "Parents",
    width: 150,
    sortable: false,
    mapping: { tabId: "basic", fieldId: "contactRelationships" },
  },

  {
    key: "status",
    work: true,
    sort: true,
    export: true,
    fixed: false,
    workOrder: 8,
    sortOrder: 2,
    exportOrder: 8,
    label: "Status",
    labelKey: "students.columns.status" as AppTranslationKey,
    exportLabel: "Status",
    width: 100,
    sortable: true,
    mapping: { tabId: "registration", fieldId: "status" },
  },
  {
    key: "registeredDate",
    work: true,
    sort: true,
    export: true,
    fixed: false,
    workOrder: 9,
    sortOrder: 4,
    exportOrder: 9,
    label: "Registration Date",
    labelKey: "students.columns.registeredDate" as AppTranslationKey,
    exportLabel: "Registration Date",
    width: 140,
    sortable: true,
    mapping: { tabId: "registration", fieldId: "registeredDate" },
  },
  {
    key: "notes",
    work: true,
    sort: false,
    export: true,
    fixed: false,
    workOrder: 10,
    sortOrder: -1,
    exportOrder: 10,
    label: "Notes",
    labelKey: "students.columns.notes" as AppTranslationKey,
    exportLabel: "Notes",
    width: 180,
    sortable: false,
    defaultEnabled: false,
    mapping: { tabId: "registration", fieldId: "notes" },
  },
  {
    key: "updatedAt",
    work: false,
    sort: true,
    export: false,
    fixed: false,
    workOrder: -1,
    sortOrder: 6,
    exportOrder: -1,
    label: "Updated",
    labelKey: undefined,
    exportLabel: "Updated",
    width: undefined,
    sortable: true,
  },
] as const;

export type StudentDirectoryColumnKey = (typeof STUDENT_DIRECTORY_COLUMN_SURFACES)[number]["key"];

export const STUDENT_WORK_COLUMN_KEYS = [
  "grNumber",
  "gender",
  "phone",
  "email",
  "dob",
  "parents",
  "status",
  "registeredDate",
  "notes",
] as const;

export type StudentWorkColumnKey = (typeof STUDENT_WORK_COLUMN_KEYS)[number];

export function studentWorkColumnLabelsFrom(
  resolveLabel: (key: string) => string,
): StudentWorkColumnLabels {
  const keys = ["name", ...STUDENT_WORK_COLUMN_KEYS] as const;
  const labels = {} as StudentWorkColumnLabels;
  for (const key of keys) {
    labels[key as keyof StudentWorkColumnLabels] = resolveLabel(key);
  }
  return labels;
}

export const DEFAULT_STUDENT_COLUMN_REGISTRY: ColumnRegistryEntry[] =
  STUDENT_DIRECTORY_COLUMN_SURFACES.filter((surface) => surface.work)
    .slice()
    .sort((left, right) => left.workOrder - right.workOrder)
    .map((surface) => ({
      key: surface.key,
      label: surface.label,
      ...(surface.labelKey ? { labelKey: surface.labelKey } : {}),
      enabled:
        "defaultEnabled" in surface && typeof surface.defaultEnabled === "boolean"
          ? surface.defaultEnabled
          : true,
      order: surface.workOrder,
      sortable: surface.sortable,
      width: surface.width,
      ...(surface.fixed ? { fixed: true } : {}),
    }));

/** Face chrome on Students Work cards — excluded from the metadata tile grid. */
export const STUDENT_CARD_FACE_COLUMN_IDS = new Set([
  "name",
  "grNumber",
  "gender",
  "phone",
  "email",
]);

export const STUDENT_COLUMN_FIELD_MAPPING: Record<string, { tabId: string; fieldId: string }> =
  (() => {
    const mapping = {} as Record<string, { tabId: string; fieldId: string }>;
    for (const surface of STUDENT_DIRECTORY_COLUMN_SURFACES) {
      if (!surface.work || !("mapping" in surface) || !surface.mapping) continue;
      mapping[surface.key as string] = {
        tabId: surface.mapping.tabId,
        fieldId: surface.mapping.fieldId,
      };
    }
    return mapping;
  })();

export const STUDENT_SORT_FIELDS = [
  "name",
  "grNumber",
  "status",
  "gender",
  "registeredDate",
  "dob",
  "updatedAt",
] as const;

export type StudentSortField = (typeof STUDENT_SORT_FIELDS)[number];
export const STUDENT_SORT_FIELD_SET: ReadonlySet<string> = new Set(STUDENT_SORT_FIELDS);

export function isStudentSortField(field: string): field is StudentSortField {
  return STUDENT_SORT_FIELD_SET.has(field);
}

export const DEFAULT_STUDENT_EXPORT_COLUMNS = STUDENT_DIRECTORY_COLUMN_SURFACES.filter(
  (surface) => surface.export,
)
  .slice()
  .sort((left, right) => left.exportOrder - right.exportOrder)
  .map((surface) => ({
    id: surface.key,
    label: surface.exportLabel,
  }));

const STUDENT_DIRECTORY_COLUMN_SURFACES_BY_KEY = new Map<
  string,
  (typeof STUDENT_DIRECTORY_COLUMN_SURFACES)[number]
>(STUDENT_DIRECTORY_COLUMN_SURFACES.map((item) => [item.key, item]));

export function studentFieldLabelKey(fieldKey: string): AppTranslationKey {
  return `students.field.${fieldKey}` as AppTranslationKey;
}

export function studentColumnLabelKey(columnKey: string): AppTranslationKey {
  const surface = STUDENT_DIRECTORY_COLUMN_SURFACES_BY_KEY.get(columnKey);
  return surface?.labelKey ?? studentFieldLabelKey(columnKey);
}
