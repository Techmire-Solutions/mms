import {
  DEFAULT_PAGE_TABS,
  DEFAULT_SETTINGS_SUB_TABS,
  type FieldConfig,
  type FieldDefinition,
  REMOVED_FORM_FIELD_KEYS,
  isContactRetiredClassificationKey,
} from "@mms/shared";
import { getContactFieldSystemDefaults } from "./contactFieldsMigration";

export function sanitizeContactFieldConfig(config: FieldConfig): FieldConfig {
  if (!config || typeof config !== "object") {
    return getContactFieldSystemDefaults();
  }

  const sanitizedConfig = { ...config };
  delete (sanitizedConfig as Record<string, unknown>).uiStrings;

  if (
    REMOVED_FORM_FIELD_KEYS.length > 0 &&
    sanitizedConfig.fields &&
    typeof sanitizedConfig.fields === "object"
  ) {
    const removed = new Set(REMOVED_FORM_FIELD_KEYS);
    const cleanedFields: Record<string, FieldDefinition[]> = {};
    for (const [tabKey, tabFields] of Object.entries(sanitizedConfig.fields)) {
      cleanedFields[tabKey] = Array.isArray(tabFields)
        ? tabFields.filter((field) => !removed.has(field.key))
        : tabFields;
    }
    sanitizedConfig.fields = cleanedFields;
  }

  if (Array.isArray(sanitizedConfig.columnRegistry)) {
    sanitizedConfig.columnRegistry = sanitizedConfig.columnRegistry.filter(
      (column) => !isContactRetiredClassificationKey(column.key),
    );
  }

  if (Array.isArray(sanitizedConfig.formTabs)) {
    sanitizedConfig.formTabs = sanitizedConfig.formTabs.filter(
      (tab) =>
        tab && typeof tab === "object" && typeof tab.key === "string" && tab.key.trim().length > 0,
    );
  }

  const validPageTabIds = new Set(DEFAULT_PAGE_TABS.map((tab) => tab.key));
  if (Array.isArray(sanitizedConfig.pageTabs)) {
    sanitizedConfig.pageTabs = sanitizedConfig.pageTabs.filter((tab) =>
      validPageTabIds.has(tab.key),
    );
  }

  if (Array.isArray(sanitizedConfig.detailTabs)) {
    sanitizedConfig.detailTabs = sanitizedConfig.detailTabs.filter(
      (tab) =>
        tab && typeof tab === "object" && typeof tab.key === "string" && tab.key.trim().length > 0,
    );
  }

  const validSettingsSubTabIds = new Set(DEFAULT_SETTINGS_SUB_TABS.map((tab) => tab.key));
  if (Array.isArray(sanitizedConfig.settingsSubTabs)) {
    sanitizedConfig.settingsSubTabs = sanitizedConfig.settingsSubTabs.filter((tab) =>
      validSettingsSubTabIds.has(tab.key),
    );
  }

  return sanitizedConfig;
}
