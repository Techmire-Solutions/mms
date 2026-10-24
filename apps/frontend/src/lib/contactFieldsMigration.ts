import {
  CONFIG_VERSION,
  DEFAULT_ENABLED_TABS,
  DEFAULT_REQUIRED_TABS,
  type FieldConfig,
  type FieldDefinition,
  INITIAL_FIELD_SEED,
  DEFAULT_PAGE_TABS,
  DEFAULT_FORM_TABS,
  DEFAULT_DETAIL_TABS,
  DEFAULT_SETTINGS_SUB_TABS,
  DEFAULT_COLUMN_REGISTRY,
  migrateEmergencyTabToRelationship,
  refreshModuleTierTabLabels,
  refreshModuleTierTabKeys,
} from "@mms/shared";

export function getContactFieldSystemDefaults(): FieldConfig {
  const fieldsClone = structuredClone(INITIAL_FIELD_SEED);

  return {
    version: CONFIG_VERSION,
    enabledTabs: [...DEFAULT_ENABLED_TABS],
    requiredTabs: [...DEFAULT_REQUIRED_TABS],
    fields: fieldsClone,
    pageTabs: [...DEFAULT_PAGE_TABS],
    formTabs: [...DEFAULT_FORM_TABS],
    detailTabs: [...DEFAULT_DETAIL_TABS],
    settingsSubTabs: [...DEFAULT_SETTINGS_SUB_TABS],
    columnRegistry: [...DEFAULT_COLUMN_REGISTRY],
  };
}

export function migrateContactFieldConfig(config: unknown): FieldConfig {
  if (!config || typeof config !== "object") {
    return getContactFieldSystemDefaults();
  }

  const rawConfig = config as Record<string, unknown>;
  const storedVersion = typeof rawConfig.version === "number" ? rawConfig.version : 0;

  if (storedVersion < 2) {
    return getContactFieldSystemDefaults();
  }

  const workingConfig: Partial<FieldConfig> & Record<string, unknown> = {
    ...(config as Partial<FieldConfig> & Record<string, unknown>),
  };
  const defaults = getContactFieldSystemDefaults();

  const normalizeTabs = <T extends { id?: string; key?: string }>(
    tabs: T[] | undefined,
  ): T[] | undefined => {
    if (!Array.isArray(tabs)) return undefined;
    return tabs.map((tab) => {
      if (tab && typeof tab === "object" && !tab.key && tab.id) {
        return { ...tab, key: tab.id };
      }
      return tab;
    });
  };

  const normalizedPageTabs = refreshModuleTierTabLabels(
    refreshModuleTierTabKeys(
      normalizeTabs(workingConfig.pageTabs) ?? defaults.pageTabs ?? DEFAULT_PAGE_TABS,
    ),
  );
  workingConfig.pageTabs = normalizedPageTabs;

  const normalizedFormTabs =
    (normalizeTabs(workingConfig.formTabs) ?? defaults.formTabs) || DEFAULT_FORM_TABS;
  const isCorruptedEnabledTabs =
    !workingConfig.enabledTabs || workingConfig.enabledTabs.length <= 1;

  const repairedFormTabs = normalizedFormTabs.map((tab) => {
    if (isCorruptedEnabledTabs && tab && typeof tab === "object") {
      const defaultTab = DEFAULT_FORM_TABS.find((d) => d.key === tab.key);
      if (defaultTab) {
        return { ...tab, enabled: defaultTab.enabled !== false };
      }
    }
    return tab;
  });

  workingConfig.formTabs = repairedFormTabs;
  const normalizedDetailTabs =
    normalizeTabs(workingConfig.detailTabs) ?? defaults.detailTabs ?? DEFAULT_DETAIL_TABS;
  workingConfig.detailTabs = normalizedDetailTabs
    .filter((tab) => tab.key !== "network")
    .map((tab, index) => {
      const defaultTab = DEFAULT_DETAIL_TABS.find((d) => d.key === tab.key);
      if (!defaultTab) return { ...tab, order: tab.order ?? index };
      return {
        ...tab,
        labelKey: tab.labelKey ?? defaultTab.labelKey,
        isSystem: true,
        order: defaultTab.order,
      };
    });
  // Ensure all current system detail tabs exist after retiring `network`.
  for (const defaultTab of DEFAULT_DETAIL_TABS) {
    if (!workingConfig.detailTabs.some((tab) => tab.key === defaultTab.key)) {
      workingConfig.detailTabs.push({ ...defaultTab });
    }
  }
  workingConfig.detailTabs.sort((a, b) => a.order - b.order);
  workingConfig.settingsSubTabs =
    normalizeTabs(workingConfig.settingsSubTabs) ?? defaults.settingsSubTabs;
  const rawCols = workingConfig.columnRegistry ?? defaults.columnRegistry ?? [];
  const existingColKeys = new Set(rawCols.map((c) => c.key));
  const missingCols = (defaults.columnRegistry ?? []).filter((c) => !existingColKeys.has(c.key));
  workingConfig.columnRegistry = [...rawCols, ...missingCols];

  const rawFields = workingConfig.fields ?? defaults.fields ?? {};
  const mergedFields: Record<string, FieldDefinition[]> = { ...defaults.fields, ...rawFields };
  for (const [tabKey, defaultTabFields] of Object.entries(defaults.fields || {})) {
    const currentTabFields = rawFields[tabKey];
    if (Array.isArray(currentTabFields) && currentTabFields.length > 0) {
      const existingFieldKeys = new Set(currentTabFields.map((f) => f.key));
      const missingFields = defaultTabFields.filter((f) => !existingFieldKeys.has(f.key));
      mergedFields[tabKey] = [...currentTabFields, ...missingFields];
    } else {
      mergedFields[tabKey] = [...defaultTabFields];
    }
  }
  workingConfig.fields = mergedFields;

  if (isCorruptedEnabledTabs) {
    const activeFormTabKeys = repairedFormTabs
      .filter((t) => t && typeof t === "object" && t.enabled !== false)
      .map((t) => t.key)
      .filter(Boolean);
    workingConfig.enabledTabs = Array.from(
      new Set([...(workingConfig.enabledTabs || []), ...activeFormTabKeys]),
    );
  }

  delete (workingConfig as Record<string, unknown>).uiStrings;

  return migrateEmergencyTabToRelationship(workingConfig as FieldConfig);
}
