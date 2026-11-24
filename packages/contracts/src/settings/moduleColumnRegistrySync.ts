import type { ColumnRegistryEntry, FieldDefinition } from "../contacts/contactFieldSchemaTypes.js";

export type ModuleColumnFieldMapping = Record<string, { tabId: string; fieldId: string }>;

export interface SyncModuleColumnRegistryWithFieldsOptions {
  defaultRegistry: ReadonlyArray<ColumnRegistryEntry>;
  columnFieldMapping: ModuleColumnFieldMapping;
  /** Tab ids that are always treated as enabled (e.g. `basic`). */
  lockedEnabledTabs: ReadonlyArray<string>;
  columnRegistry: ReadonlyArray<ColumnRegistryEntry> | undefined;
  fields: Record<string, ReadonlyArray<FieldDefinition>>;
  enabledTabIds: Iterable<string>;
  /**
   * When set, upserts `custom:{field.key}` columns for enabled custom fields
   * and drops custom columns whose fields are no longer enabled.
   */
  listEnabledCustomFields?: (
    fields: Record<string, ReadonlyArray<FieldDefinition>>,
  ) => ReadonlyArray<FieldDefinition>;
  /**
   * When true, drop stored system keys that are not in `defaultRegistry`
   * (Students). Contacts soft-merges unknown keys (false / omit).
   */
  dropUnknownSystemKeys?: boolean;
}

function customColumnKey(fieldKey: string): string {
  return `custom:${fieldKey}`;
}

function withLockedEnabledTabs(
  enabledTabIds: Iterable<string>,
  lockedEnabledTabs: readonly string[],
): Set<string> {
  const enabled = new Set<string>();
  for (const tabId of enabledTabIds) {
    const trimmed = tabId?.trim().toLowerCase();
    if (trimmed) enabled.add(trimmed);
  }
  for (const locked of lockedEnabledTabs) {
    enabled.add(locked.toLowerCase());
  }
  return enabled;
}

/**
 * Aligns a module `columnRegistry.enabled` with Setup Fields tab/field enablement.
 * Mapped columns for disabled tabs/fields are forced off; when active again they
 * restore the default registry enabled flag (custom / unmapped columns keep stored enabled).
 */
export function syncModuleColumnRegistryWithFields(
  options: SyncModuleColumnRegistryWithFieldsOptions,
): ColumnRegistryEntry[] {
  const {
    defaultRegistry,
    columnFieldMapping,
    lockedEnabledTabs,
    columnRegistry,
    fields,
    enabledTabIds,
    listEnabledCustomFields,
    dropUnknownSystemKeys = false,
  } = options;

  const enabledTabs = withLockedEnabledTabs(enabledTabIds, lockedEnabledTabs);
  const defaultKeys = new Set(defaultRegistry.map((entry) => entry.key));

  const byKey = new Map<string, ColumnRegistryEntry>();
  for (const col of defaultRegistry) {
    byKey.set(col.key, { ...col });
  }

  for (const col of columnRegistry || []) {
    if (dropUnknownSystemKeys && !col.key.startsWith("custom:") && !defaultKeys.has(col.key)) {
      continue;
    }
    const existing = byKey.get(col.key);
    byKey.set(col.key, existing ? { ...existing, ...col } : { ...col });
  }

  if (listEnabledCustomFields) {
    const customFields = listEnabledCustomFields(fields);
    for (const field of customFields) {
      const key = customColumnKey(field.key);
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          label: field.label,
          labelKey: field.labelKey,
          enabled: true,
          order: 100 + (field.order ?? 0),
          sortable: false,
        });
      } else {
        const existing = byKey.get(key)!;
        byKey.set(key, {
          ...existing,
          label: field.label || existing.label,
          labelKey: field.labelKey ?? existing.labelKey,
          enabled: existing.enabled !== false,
        });
      }
    }

    const enabledCustomKeys = new Set(customFields.map((field) => customColumnKey(field.key)));
    for (const key of [...byKey.keys()]) {
      if (key.startsWith("custom:") && !enabledCustomKeys.has(key)) {
        byKey.delete(key);
      }
    }
  }

  const fieldLookup = new Map<string, FieldDefinition>();
  if (fields && typeof fields === "object") {
    for (const [tabId, tabFields] of Object.entries(fields)) {
      if (!Array.isArray(tabFields)) continue;
      const tabKey = tabId.toLowerCase();
      for (const field of tabFields) {
        fieldLookup.set(`${tabKey}:${field.key}`, field);
      }
    }
  }

  return Array.from(byKey.values())
    .map((col) => {
      const mapping = columnFieldMapping[col.key];
      if (!mapping) return col;

      const tabOk = enabledTabs.has(mapping.tabId.toLowerCase());
      const field = fieldLookup.get(`${mapping.tabId.toLowerCase()}:${mapping.fieldId}`);
      const fieldOk = field ? field.enabled !== false : true;
      if (!tabOk || !fieldOk) {
        return { ...col, enabled: false };
      }

      return col;
    })
    .sort((a, b) => a.order - b.order);
}
