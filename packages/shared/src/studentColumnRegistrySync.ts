import type { ColumnRegistryEntry, FieldDefinition } from "./contactTypes.js";
import type { StudentsSettings } from "./settingsTypes.js";
import {
  DEFAULT_STUDENT_COLUMN_REGISTRY,
  STUDENT_COLUMN_FIELD_MAPPING,
} from "./moduleFieldSetupPersons.js";
import {
  listEnabledCustomStudentFormFields,
  resolveStudentFieldsMapForColumnSync,
} from "./studentFormCustomFields.js";
import { resolveStudentEnabledTabIds } from "./studentSetupConfigTypes.js";
import { syncModuleColumnRegistryWithFields } from "./moduleColumnRegistrySync.js";
import { customFieldKeyFromColumnKey, type ModuleColumnRegistryEntry } from "./moduleColumnCore.js";

const STUDENT_LOCKED_ENABLED_TABS = ["basic"] as const;

/**
 * Aligns Students `columnRegistry.enabled` with Setup Fields tab/field enablement.
 * Mapped system columns for disabled tabs/fields are forced off; when active again they
 * restore the default registry enabled flag. Custom columns (`custom:{key}`) stay when
 * the field is enabled and drop when disabled.
 */
export function syncStudentColumnRegistryWithFields(
  columnRegistry: ColumnRegistryEntry[] | undefined,
  fields: Record<string, FieldDefinition[]>,
  enabledTabIds: Iterable<string>,
): ColumnRegistryEntry[] {
  return syncModuleColumnRegistryWithFields({
    defaultRegistry: DEFAULT_STUDENT_COLUMN_REGISTRY,
    columnFieldMapping: STUDENT_COLUMN_FIELD_MAPPING,
    lockedEnabledTabs: STUDENT_LOCKED_ENABLED_TABS,
    columnRegistry,
    fields,
    enabledTabIds,
    listEnabledCustomFields: listEnabledCustomStudentFormFields,
    dropUnknownSystemKeys: true,
  });
}

export interface StudentWorkColumnLabels {
  name: string;
  grNumber: string;
  gender: string;
  phone: string;
  email: string;
  dob: string;
  parents: string;
  status: string;
  registeredDate: string;
  notes: string;
}

/** Builds tenant-default Work column registry for Students (before per-user overlay). */
export function buildStudentWorkColumnRegistry(
  settings: StudentsSettings,
  labels: StudentWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  const fields = resolveStudentFieldsMapForColumnSync(settings?.fields);
  const enabledTabs = resolveStudentEnabledTabIds(settings);
  const storedRegistry = Array.isArray(settings?.columnRegistry)
    ? settings.columnRegistry
    : undefined;
  const synced = syncStudentColumnRegistryWithFields(
    storedRegistry ?? DEFAULT_STUDENT_COLUMN_REGISTRY,
    fields,
    enabledTabs,
  );

  const labelByKey: Record<string, string> = {
    name: labels.name,
    grNumber: labels.grNumber,
    gender: labels.gender,
    phone: labels.phone,
    email: labels.email,
    dob: labels.dob,
    parents: labels.parents,
    status: labels.status,
    registeredDate: labels.registeredDate,
    notes: labels.notes,
  };

  const customByKey = new Map(
    listEnabledCustomStudentFormFields(fields).map((field) => [field.key, field]),
  );

  return synced.map((col) => {
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
}
