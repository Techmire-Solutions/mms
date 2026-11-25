import type { ColumnRegistryEntry, FieldDefinition } from "../contacts/contactTypes.js";
import type { FacultySettings } from "./facultyModuleSettings.js";
import { FACULTY_LOCKED_ENABLED_TABS } from "../settings/moduleFieldSetupFaculty.js";
import type { FacultyWorkColumnLabels } from "./facultyDirectoryColumns.js";
import {
  DEFAULT_FACULTY_COLUMN_REGISTRY,
  FACULTY_COLUMN_FIELD_MAPPING,
  facultyWorkColumnLabelsFrom,
} from "./facultyDirectoryColumns.js";
import {
  applyModuleColumnKinds,
  customFieldKeyFromColumnKey,
  type ModuleColumnKind,
  type ModuleColumnRegistryEntry,
} from "../settings/moduleColumnCore.js";
import { syncModuleColumnRegistryWithFields } from "../settings/moduleColumnRegistrySync.js";
import {
  listEnabledCustomFacultyFormFields,
  resolveFacultyFieldsMapForColumnSync,
} from "./facultyFormCustomFields.js";
import { resolveFacultyEnabledTabIds } from "./facultyEnabledTabs.js";

export type { FacultyWorkColumnLabels };

/** Labels for preflight / sync (keys only matter for dependency checks). */
export const FACULTY_WORK_COLUMN_PLACEHOLDER_LABELS: FacultyWorkColumnLabels =
  facultyWorkColumnLabelsFrom((key) => key);

/** Default Work column registry from seed (no tenant customs). */
export function defaultFacultyWorkColumnRegistry(): ColumnRegistryEntry[] {
  return DEFAULT_FACULTY_COLUMN_REGISTRY.map((col: ColumnRegistryEntry) => ({ ...col }));
}

/**
 * Aligns Faculty Work column registry with Setup Fields draft enablement
 * ({@link DEFAULT_FACULTY_COLUMN_REGISTRY} / {@link FACULTY_COLUMN_FIELD_MAPPING} SSOT).
 */
export function syncFacultyColumnRegistryWithFields(
  columnRegistry: ColumnRegistryEntry[] | undefined,
  fields: Record<string, FieldDefinition[]>,
  enabledTabIds: Iterable<string>,
): ColumnRegistryEntry[] {
  return syncModuleColumnRegistryWithFields({
    defaultRegistry: DEFAULT_FACULTY_COLUMN_REGISTRY,
    columnFieldMapping: FACULTY_COLUMN_FIELD_MAPPING,
    lockedEnabledTabs: FACULTY_LOCKED_ENABLED_TABS,
    columnRegistry,
    fields,
    enabledTabIds,
    listEnabledCustomFields: listEnabledCustomFacultyFormFields,
    dropUnknownSystemKeys: true,
  });
}

/** Content kind per built-in Work column; custom (`custom:*`) columns size as short text. */
const FACULTY_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  name: "identity",
  employeeId: "reference",
  designation: "shortText",
  department: "shortText",
  reportingFacultyName: "person",
  employDesignationStatus: "status",
  designationStartDate: "date",
  designationEndDate: "date",
  status: "status",
  employmentStartDate: "date",
  employmentEndDate: "date",
  specialization: "shortText",
  qualification: "shortText",
  notes: "longText",
  performanceRating: "number",
  profileStatus: "status",
  updatedAt: "dateTime",
};

/** Builds tenant-default Work column registry for Faculty (before per-user overlay). */
export function buildFacultyWorkColumnRegistry(
  settings: FacultySettings,
  labels: FacultyWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  const fields = resolveFacultyFieldsMapForColumnSync(settings.fields);
  const enabledTabs = resolveFacultyEnabledTabIds(settings);
  const synced = syncFacultyColumnRegistryWithFields(
    settings.columnRegistry ?? DEFAULT_FACULTY_COLUMN_REGISTRY,
    fields,
    enabledTabs,
  );

  const labelByKey: Record<string, string> = {
    name: labels.name,
    designation: labels.designation,
    department: labels.department,
    employmentStartDate: labels.employmentStartDate,
    performanceRating: labels.performanceRating,
    status: labels.status,
  };

  const customByKey = new Map(
    listEnabledCustomFacultyFormFields(fields).map((field) => [field.key, field]),
  );

  const entries: ModuleColumnRegistryEntry[] = synced.map((col) => {
    const customFieldKey = customFieldKeyFromColumnKey(col.key);
    if (customFieldKey !== null) {
      const field = customByKey.get(customFieldKey);
      return {
        key: col.key,
        label: field?.label || col.label,
        enabled: col.enabled !== false,
        order: col.order,
        width: col.width,
        fixed: col.fixed,
      };
    }
    return {
      key: col.key,
      label: labelByKey[col.key] || col.label,
      enabled: col.enabled !== false,
      order: col.order,
      width: col.width,
      fixed: col.fixed || col.key === "name",
    };
  });
  const kinds: Record<string, ModuleColumnKind> = { ...FACULTY_COLUMN_KINDS };
  for (const entry of entries) {
    if (customFieldKeyFromColumnKey(entry.key) !== null) kinds[entry.key] = "shortText";
  }
  return applyModuleColumnKinds(entries, kinds);
}
