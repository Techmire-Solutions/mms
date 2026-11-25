import {
  DEFAULT_STUDENT_COLUMN_REGISTRY,
  DEFAULT_STUDENT_ENABLED_TABS,
  DEFAULT_STUDENT_REQUIRED_TABS,
  DEFAULT_STUDENTS_SETTINGS,
  INITIAL_STUDENT_FIELD_SEED,
  STUDENT_TAB_REGISTRY,
  type StudentCustomField,
  type StudentsSettings,
} from "../settings/settingsTypes.js";
import type { FieldDefinition } from "../contacts/contactTypes.js";
import {
  refreshModuleTierTabKeys,
  refreshModuleTierTabLabels,
} from "../settings/moduleTierTabs.js";
import {
  OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS,
  STUDENT_SETTINGS_VERSION,
  applyStudentSetupVersionMigrate,
  isLegacyFlatFields,
  normalizeTabs,
} from "./studentSettingsMigrate.js";

export {
  STUDENT_SETTINGS_VERSION,
  OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS,
} from "./studentSettingsMigrate.js";

function cloneStudentSettings(settings: StudentsSettings): StudentsSettings {
  return JSON.parse(JSON.stringify(settings)) as StudentsSettings;
}

export function normalizeStudentsSettings(config: unknown): StudentsSettings {
  const defaults = cloneStudentSettings(DEFAULT_STUDENTS_SETTINGS);
  if (!config || typeof config !== "object") {
    return {
      ...defaults,
      formTabs: refreshModuleTierTabLabels(refreshModuleTierTabKeys([...STUDENT_TAB_REGISTRY])),
      enabledTabs: [...DEFAULT_STUDENT_ENABLED_TABS],
      requiredTabs: [...DEFAULT_STUDENT_REQUIRED_TABS],
      fields: JSON.parse(JSON.stringify(INITIAL_STUDENT_FIELD_SEED)) as Record<
        string,
        FieldDefinition[]
      >,
      columnRegistry: [...DEFAULT_STUDENT_COLUMN_REGISTRY],
      version: STUDENT_SETTINGS_VERSION,
    };
  }

  const rawConfig = config as Record<string, unknown>;
  const storedVersion = typeof rawConfig.version === "number" ? rawConfig.version : 0;
  const draft = { ...rawConfig } as Partial<StudentsSettings>;
  const hasLegacyFlatFields = isLegacyFlatFields(draft.fields);
  const hasModernTabbedFields =
    !!draft.fields &&
    !hasLegacyFlatFields &&
    typeof draft.fields === "object" &&
    Object.keys(draft.fields).length > 0;

  if (!hasModernTabbedFields && (storedVersion < 2 || !draft.fields || hasLegacyFlatFields)) {
    const legacyFields = (draft.fields ?? {}) as Record<
      string,
      { enabled?: boolean; required?: boolean }
    >;
    const legacyCustomFields = (draft.customFields ?? []) as StudentCustomField[];
    const legacyFieldOrder = (draft.fieldOrder ?? []) as string[];

    draft.formTabs = refreshModuleTierTabLabels(
      refreshModuleTierTabKeys([...STUDENT_TAB_REGISTRY]),
    );
    draft.enabledTabs = [...DEFAULT_STUDENT_ENABLED_TABS];
    draft.requiredTabs = [...DEFAULT_STUDENT_REQUIRED_TABS];
    draft.columnRegistry = [...DEFAULT_STUDENT_COLUMN_REGISTRY];

    const migratedFields: Record<string, FieldDefinition[]> = {};
    for (const [tabKey, seedFields] of Object.entries(INITIAL_STUDENT_FIELD_SEED)) {
      migratedFields[tabKey] = seedFields.map((field) => {
        if (field.key === "contactRelationships") {
          const sawTriad = [...OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS].some(
            (key) => legacyFields[key] != null,
          );
          const anyTriadEnabled = [...OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS].some(
            (key) => legacyFields[key]?.enabled !== false && legacyFields[key] != null,
          );
          const legacyCfg = legacyFields.contactRelationships;
          return {
            ...field,
            enabled: legacyCfg
              ? (legacyCfg.enabled ?? field.enabled)
              : sawTriad
                ? anyTriadEnabled
                : field.enabled,
            required: legacyCfg?.required ?? field.required,
          };
        }
        const legacyCfg = legacyFields[field.key];
        return {
          ...field,
          enabled: legacyCfg?.enabled ?? field.enabled,
          required: legacyCfg?.required ?? field.required,
        };
      });
    }

    if (legacyCustomFields.length > 0) {
      migratedFields.basic ??= [];
      for (const legacyCustomField of legacyCustomFields) {
        if (migratedFields.basic.some((field) => field.key === legacyCustomField.id)) continue;
        migratedFields.basic.push({
          key: legacyCustomField.id,
          label: legacyCustomField.label,
          type: (legacyCustomField.type ?? "text") as FieldDefinition["type"],
          enabled: true,
          required: legacyCustomField.required ?? false,
          options: legacyCustomField.options,
          order: migratedFields.basic.length,
        });
      }
    }

    if (legacyFieldOrder.length > 0) {
      const remappedOrder = legacyFieldOrder.map((fieldKey) =>
        OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS.has(fieldKey) ? "contactRelationships" : fieldKey,
      );
      const orderMap = Object.fromEntries(
        remappedOrder.map((fieldKey, index) => [fieldKey, index]),
      );
      for (const fieldsList of Object.values(migratedFields)) {
        fieldsList.sort((leftField, rightField) => {
          const leftFieldOrder = orderMap[leftField.key] ?? 9999;
          const rightFieldOrder = orderMap[rightField.key] ?? 9999;
          return leftFieldOrder - rightFieldOrder;
        });
        fieldsList.forEach((field, index) => {
          field.order = index;
        });
      }
    }

    draft.fields = migratedFields;
    draft.version = 2;
  } else {
    draft.formTabs = refreshModuleTierTabLabels(
      refreshModuleTierTabKeys(
        normalizeTabs(draft.formTabs) ?? defaults.formTabs ?? STUDENT_TAB_REGISTRY,
      ),
    );
    draft.enabledTabs = Array.isArray(draft.enabledTabs)
      ? draft.enabledTabs
      : Array.isArray(defaults.enabledTabs)
        ? defaults.enabledTabs
        : DEFAULT_STUDENT_ENABLED_TABS;
    draft.requiredTabs =
      draft.requiredTabs ?? defaults.requiredTabs ?? DEFAULT_STUDENT_REQUIRED_TABS;
    draft.fields =
      draft.fields && typeof draft.fields === "object" && Object.keys(draft.fields).length > 0
        ? draft.fields
        : defaults.fields;
    draft.columnRegistry = Array.isArray(draft.columnRegistry)
      ? draft.columnRegistry
      : Array.isArray(defaults.columnRegistry)
        ? defaults.columnRegistry
        : DEFAULT_STUDENT_COLUMN_REGISTRY;
  }

  applyStudentSetupVersionMigrate(draft);

  const merged = {
    ...defaults,
    ...draft,
    enabledTabs: draft.enabledTabs ?? defaults.enabledTabs ?? DEFAULT_STUDENT_ENABLED_TABS,
    requiredTabs: draft.requiredTabs ?? defaults.requiredTabs ?? DEFAULT_STUDENT_REQUIRED_TABS,
    fields:
      draft.fields && typeof draft.fields === "object" && Object.keys(draft.fields).length > 0
        ? draft.fields
        : defaults.fields,
    version: typeof draft.version === "number" ? draft.version : STUDENT_SETTINGS_VERSION,
  } as StudentsSettings;

  if (Array.isArray(merged.formTabs)) {
    merged.formTabs = merged.formTabs.filter(
      (tab) =>
        tab && typeof tab === "object" && typeof tab.key === "string" && tab.key.trim().length > 0,
    );
  }

  // Strip retired Setup Preferences keys from legacy students_settings documents.
  const legacyPrefs = merged as StudentsSettings & {
    requireGuardian?: unknown;
    requirePhoto?: unknown;
    defaultViewLayout?: unknown;
    idPrefix?: unknown;
    defaultGender?: unknown;
    minAge?: unknown;
    maxAge?: unknown;
    allowSiblingDiscount?: unknown;
  };
  delete legacyPrefs.requireGuardian;
  delete legacyPrefs.requirePhoto;
  delete legacyPrefs.defaultViewLayout;
  delete legacyPrefs.idPrefix;
  delete legacyPrefs.defaultGender;
  delete legacyPrefs.minAge;
  delete legacyPrefs.maxAge;
  delete legacyPrefs.allowSiblingDiscount;

  return merged;
}
