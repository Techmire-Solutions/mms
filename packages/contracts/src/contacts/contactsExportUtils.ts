import type { FieldConfig, FieldDefinition, TabDefinition } from "./contactTypes.js";
import {
  canViewContactColumn,
  resolveContactColumnField,
  type ContactColumnFieldContext,
} from "./contactColumnAccess.js";
import {
  COLUMN_FIELD_MAPPING,
  DEFAULT_COLUMN_REGISTRY,
  DEFAULT_FORM_TABS,
} from "./contactTabRegistry.js";
import { INITIAL_FIELD_SEED } from "./contactFieldSeed.js";
import { canViewContactTab } from "./contactFieldAccess.js";
import { isContactLockedEnabledTab, resolveContactEnabledTabIds } from "./contactEnabledTabs.js";
import { listEnabledCustomContactFormFields } from "./contactFormCustomFields.js";
import type { ContactExportColumn } from "./contactExportColumns.js";
import { DEFAULT_CONTACT_EXPORT_COLUMNS } from "./contactExportColumns.js";

export * from "./contactExportColumns.js";
export * from "./contactExportExtractors.js";

/**
 * Sanitizer snapshot for a tenant, falling back to the default seed when the tenant has no
 * stored field config.
 */
export function resolveContactFieldConfigSnapshot(fieldConfig: FieldConfig | null | undefined): {
  fields: Record<string, FieldDefinition[]>;
  tabs: TabDefinition[];
} {
  if (fieldConfig?.fields) {
    return { fields: fieldConfig.fields, tabs: fieldConfig.formTabs ?? [] };
  }
  return { fields: INITIAL_FIELD_SEED, tabs: DEFAULT_FORM_TABS };
}

function buildColumnFieldContext(
  fieldConfig: FieldConfig,
  viewerRole: string,
): ContactColumnFieldContext {
  const enabledTabIds = resolveContactEnabledTabIds(fieldConfig, viewerRole);
  const formTabs = fieldConfig.formTabs ?? [];
  const tabMap = new Map<string, (typeof formTabs)[number]>();
  for (const t of formTabs) {
    if (t.key) tabMap.set(t.key.toLowerCase(), t);
  }

  const fieldEnabledMap = new Map<string, boolean>();
  for (const [tabId, tabFields] of Object.entries(fieldConfig.fields ?? {})) {
    for (const f of tabFields) {
      if (f.key) {
        fieldEnabledMap.set(`${tabId.toLowerCase()}:${f.key}`, f.enabled !== false);
      }
    }
  }

  const tabAllows = (tabId: string): boolean => {
    if (isContactLockedEnabledTab(tabId)) return true;
    if (formTabs.length === 0) return true;
    const tab = tabMap.get(tabId.toLowerCase());
    if (!tab) return true;
    return tab.enabled !== false && canViewContactTab(viewerRole, tab);
  };

  return {
    fields: fieldConfig.fields,
    enabledTabIds,
    isTabFieldEnabled: (tabId, fieldId) => {
      if (!tabAllows(tabId)) return false;
      return fieldEnabledMap.get(`${tabId.toLowerCase()}:${fieldId}`) ?? true;
    },
  };
}

/** Registry column ids the Work directory can render (SSOT: column registry + field mapping). */
const KNOWN_EXPORT_COLUMN_IDS: ReadonlySet<string> = new Set<string>([
  ...DEFAULT_COLUMN_REGISTRY.map((column) => column.key),
  ...Object.keys(COLUMN_FIELD_MAPPING),
]);

/**
 * Fail-closed gate for a client-requested export column.
 *
 * A column is exportable only when it is either
 * 1. a known registry column whose governing tab/field is enabled for the viewer, or
 * 2. a key that resolves to a configured field the viewer may read (custom fields).
 */
export function isExportableContactColumn(
  viewerRole: string,
  columnKey: string,
  columnFieldContext: ContactColumnFieldContext | null,
): boolean {
  const mapping = COLUMN_FIELD_MAPPING[columnKey];
  const knownColumn = mapping != null || KNOWN_EXPORT_COLUMN_IDS.has(columnKey);
  if (!columnFieldContext) return knownColumn;
  if (!canViewContactColumn(viewerRole, columnKey, columnFieldContext)) return false;
  if (knownColumn) {
    if (!mapping) return true;
    return (
      columnFieldContext.enabledTabIds.has(mapping.tabId) &&
      columnFieldContext.isTabFieldEnabled(mapping.tabId, mapping.fieldId)
    );
  }
  if (columnFieldContext.enabledTabIds.has(columnKey.toLowerCase())) {
    return true;
  }
  return resolveContactColumnField(columnKey, columnFieldContext) != null;
}

/**
 * Resolves all exportable columns for a tenant, combining the comprehensive
 * standard form columns with any enabled custom fields or tabs in fieldConfig.
 */
export function resolveAllContactExportColumns(
  fieldConfig?: Partial<FieldConfig> | null,
): ContactExportColumn[] {
  const columns: ContactExportColumn[] = [...DEFAULT_CONTACT_EXPORT_COLUMNS];
  if (!fieldConfig?.fields) return columns;

  const existingIds = new Set(columns.map((c) => c.id.toLowerCase()));
  const customFields = listEnabledCustomContactFormFields(fieldConfig.fields);
  for (const field of customFields) {
    const keyLower = field.key.toLowerCase();
    if (!existingIds.has(keyLower)) {
      existingIds.add(keyLower);
      columns.push({ id: field.key, label: field.label || field.key });
    }
  }

  if (fieldConfig.formTabs) {
    for (const tab of fieldConfig.formTabs) {
      const keyLower = tab.key.toLowerCase();
      if (tab.enabled !== false && !existingIds.has(keyLower)) {
        const isStandard = DEFAULT_FORM_TABS.some((dt) => dt.key.toLowerCase() === keyLower);
        if (!isStandard) {
          existingIds.add(keyLower);
          columns.push({ id: tab.key, label: tab.label || tab.key });
        }
      }
    }
  }
  return columns;
}

/** Merges any enabled custom fields from fieldConfig into the given columns list. */
export function mergeCustomContactExportColumns(
  columns: ContactExportColumn[],
  fieldConfig?: Partial<FieldConfig> | null,
): ContactExportColumn[] {
  if (!fieldConfig?.fields || columns.length === 0) return columns;
  const existingIds = new Set(columns.map((c) => c.id.toLowerCase()));
  const merged = [...columns];
  const customFields = listEnabledCustomContactFormFields(fieldConfig.fields);
  for (const field of customFields) {
    const keyLower = field.key.toLowerCase();
    if (!existingIds.has(keyLower)) {
      existingIds.add(keyLower);
      merged.push({ id: field.key, label: field.label || field.key });
    }
  }
  return merged;
}

/** Filters export columns by the same field/tab visibility rules as Work columns. */
export function filterContactExportColumnsForViewer(
  columns: ContactExportColumn[],
  fieldConfig: FieldConfig | null | undefined,
  viewerRole: string,
): ContactExportColumn[] {
  const source =
    columns.length > 0
      ? columns.length >= DEFAULT_CONTACT_EXPORT_COLUMNS.length
        ? mergeCustomContactExportColumns(columns, fieldConfig)
        : columns
      : resolveAllContactExportColumns(fieldConfig);
  const columnFieldContext = fieldConfig?.fields
    ? buildColumnFieldContext(fieldConfig, viewerRole)
    : null;
  return source.filter((column) =>
    isExportableContactColumn(viewerRole, column.id, columnFieldContext),
  );
}
