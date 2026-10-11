/** Migrates legacy contacts "emergency" form tab / column keys to "relationship". */
import type {
  ColumnRegistryEntry,
  FieldConfig,
  FieldDefinition,
  TabDefinition,
} from "./contactFieldSchemaTypes.js";

const LEGACY_EMERGENCY_FORM_TAB = "emergency";
const CONTACT_RELATIONSHIP_FORM_TAB = "relationship";

/** Legacy Work-column keys → modern relationship column keys. */
const LEGACY_EMERGENCY_COLUMN_KEY_MAP = {
  emergency_contact: "relationship_contact",
  emergency_relationship: "relationship_type",
} as const;

type LegacyEmergencyColumnKey = keyof typeof LEGACY_EMERGENCY_COLUMN_KEY_MAP;

/** Remaps a form / enabled-tab id from legacy emergency → relationship. */
export function normalizeContactFormTabId(tabId: string): string {
  return tabId === LEGACY_EMERGENCY_FORM_TAB ? CONTACT_RELATIONSHIP_FORM_TAB : tabId;
}

/** Remaps a Work / card column key from legacy emergency_* → relationship_*. */
export function normalizeContactColumnKey(columnKey: string): string {
  return LEGACY_EMERGENCY_COLUMN_KEY_MAP[columnKey as LegacyEmergencyColumnKey] ?? columnKey;
}

/** Remaps saved-report field ids (`emergencyContact` → `relationshipContact`). */
export function normalizeContactReportFieldId(fieldId: string): string {
  return fieldId === "emergencyContact" ? "relationshipContact" : fieldId;
}

/** Renames the stored tab label when a legacy emergency tab becomes relationship. */
export function normalizeContactTabLabel(tabKey: string, label: string): string {
  const isLegacy = tabKey === LEGACY_EMERGENCY_FORM_TAB || label === "Emergency";
  return isLegacy && normalizeContactFormTabId(tabKey) === CONTACT_RELATIONSHIP_FORM_TAB
    ? "Relationship"
    : label;
}

export function isRelationshipContactColumnKey(columnKey: string): boolean {
  return normalizeContactColumnKey(columnKey) === "relationship_contact";
}

export function isRelationshipTypeColumnKey(columnKey: string): boolean {
  return normalizeContactColumnKey(columnKey) === "relationship_type";
}

export function isRelationshipWorkColumnKey(columnKey: string): boolean {
  const key = normalizeContactColumnKey(columnKey);
  return key === "relationship_contact" || key === "relationship_type";
}

/** True when enabled tabs include relationship (or legacy emergency). */
export function isContactRelationshipTabEnabled(
  enabledTabIds: ReadonlySet<string> | Iterable<string>,
): boolean {
  for (const tabId of enabledTabIds) {
    if (normalizeContactFormTabId(tabId) === CONTACT_RELATIONSHIP_FORM_TAB) return true;
  }
  return false;
}

/**
 * Resolves which field-config tab holds relationship fields after/before migration.
 * Prefers modern `relationship`; falls back to legacy `emergency` when still present.
 */
export function resolveRelationshipFieldsTabId(
  fields: Record<string, unknown> | undefined,
  enabledTabIds?: ReadonlySet<string> | Iterable<string>,
): typeof CONTACT_RELATIONSHIP_FORM_TAB | typeof LEGACY_EMERGENCY_FORM_TAB | null {
  if (enabledTabIds) {
    const enabled = new Set([...enabledTabIds].map((tabId) => normalizeContactFormTabId(tabId)));
    if (enabled.has(CONTACT_RELATIONSHIP_FORM_TAB)) {
      if (fields?.[CONTACT_RELATIONSHIP_FORM_TAB]) return CONTACT_RELATIONSHIP_FORM_TAB;
      if (fields?.[LEGACY_EMERGENCY_FORM_TAB]) return LEGACY_EMERGENCY_FORM_TAB;
      return CONTACT_RELATIONSHIP_FORM_TAB;
    }
  }
  if (fields?.[CONTACT_RELATIONSHIP_FORM_TAB]) return CONTACT_RELATIONSHIP_FORM_TAB;
  if (fields?.[LEGACY_EMERGENCY_FORM_TAB]) return LEGACY_EMERGENCY_FORM_TAB;
  return null;
}

/** Remap keys on persisted user column preference overlays. */
export function migrateContactColumnPreferenceKeys<T extends { key: string }>(
  prefs: readonly T[],
): T[] {
  return prefs.map((pref) => {
    const nextKey = normalizeContactColumnKey(pref.key);
    return nextKey === pref.key ? pref : { ...pref, key: nextKey };
  });
}

function migrateTabs(tabs: TabDefinition[] | undefined): TabDefinition[] | undefined {
  if (!Array.isArray(tabs)) return tabs;
  const migrated = tabs.map((tab) => {
    if (!tab || typeof tab !== "object") return tab;
    const nextKey = normalizeContactFormTabId(tab.key);
    const legacyLabelKey = tab.labelKey as string | undefined;
    return {
      ...tab,
      key: nextKey,
      label: normalizeContactTabLabel(tab.key, tab.label),
      labelKey:
        legacyLabelKey === "contacts.form.tabEmergency" ||
        legacyLabelKey === "contacts.tabs.emergency"
          ? "contacts.form.tabRelationship"
          : tab.labelKey,
    };
  });
  const seenKeys = new Set<string>();
  return migrated.filter((tab) => {
    if (!tab || typeof tab !== "object") return true;
    if (seenKeys.has(tab.key)) return false;
    seenKeys.add(tab.key);
    return true;
  });
}

function migrateFields(
  fields: Record<string, FieldDefinition[]> | undefined,
): Record<string, FieldDefinition[]> | undefined {
  if (!fields || typeof fields !== "object") return fields;
  if (!fields[LEGACY_EMERGENCY_FORM_TAB]) return fields;
  const next = { ...fields };
  if (!next[CONTACT_RELATIONSHIP_FORM_TAB]) {
    next[CONTACT_RELATIONSHIP_FORM_TAB] = next[LEGACY_EMERGENCY_FORM_TAB];
  }
  delete next[LEGACY_EMERGENCY_FORM_TAB];
  return next;
}

function migrateStringList(list: string[] | undefined): string[] | undefined {
  if (!Array.isArray(list)) return list;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of list) {
    const normalized = normalizeContactFormTabId(entry);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function migrateColumnRegistry(
  columns: ColumnRegistryEntry[] | undefined,
): ColumnRegistryEntry[] | undefined {
  if (!Array.isArray(columns)) return columns;
  return columns.map((column) => {
    if (!column || typeof column !== "object") return column;
    const legacyKey = column.key as string;
    const nextKey = normalizeContactColumnKey(legacyKey);
    if (nextKey === legacyKey) return column;
    return {
      ...column,
      key: nextKey,
      label: isRelationshipContactColumnKey(legacyKey)
        ? "Relationship Contact"
        : isRelationshipTypeColumnKey(legacyKey)
          ? "Relationship Type"
          : column.label,
      labelKey: isRelationshipContactColumnKey(legacyKey)
        ? "contacts.columns.relationshipContact"
        : isRelationshipTypeColumnKey(legacyKey)
          ? "contacts.columns.relationshipType"
          : column.labelKey,
    };
  });
}

/**
 * Remaps persisted contact field config from the legacy emergency tab/columns
 * to relationship. Safe to run repeatedly.
 */
export function migrateEmergencyTabToRelationship(config: FieldConfig): FieldConfig {
  return {
    ...config,
    formTabs: migrateTabs(config.formTabs) ?? config.formTabs,
    enabledTabs: migrateStringList(config.enabledTabs) ?? config.enabledTabs,
    requiredTabs: migrateStringList(config.requiredTabs) ?? config.requiredTabs,
    fields: migrateFields(config.fields) ?? config.fields,
    columnRegistry: migrateColumnRegistry(config.columnRegistry) ?? config.columnRegistry,
  };
}
