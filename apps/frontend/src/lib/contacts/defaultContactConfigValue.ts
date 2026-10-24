import {
  DEFAULT_COLUMN_REGISTRY,
  DEFAULT_FORM_TABS,
  INITIAL_FIELD_SEED,
  normalizeContactPreferences,
  resolveContactEnabledTabIds,
  resolveRelationshipPairs,
  deriveRelationshipOptionsFromPairs,
  applyRelationshipOptionOrder,
} from "@mms/shared";
import type { ContactConfigContextType } from "./contactConfigContextTypes";
import { getContactConfigCollectionDefaults } from "./contactConfigSeeds";
import { getFallbackCountryCode } from "./contactI18n";

let cachedDefault: ContactConfigContextType | null = null;

/**
 * Returns a static default ContactConfigContext value used when components
 * mount outside a <ContactConfigProvider> or during unauthenticated transitions.
 */
export function getDefaultContactConfigContextValue(): ContactConfigContextType {
  if (cachedDefault) {
    return cachedDefault;
  }

  const seeded = getContactConfigCollectionDefaults();
  const prefs = normalizeContactPreferences(null);
  const countryCodesMap = Object.fromEntries(
    seeded.countryCodes.map((c) => [c.country.toLowerCase(), c.code]),
  );
  const derivedRelationships = deriveRelationshipOptionsFromPairs(
    resolveRelationshipPairs(prefs.relationshipPairs),
  );
  const relationships = applyRelationshipOptionOrder(
    derivedRelationships,
    prefs.relationshipOptionOrder,
  );

  const availableColumns = DEFAULT_COLUMN_REGISTRY.map((entry) => ({
    id: entry.key,
    label: entry.label,
    sortField: entry.sortField,
    width: entry.width,
  }));

  const visibleColumns = DEFAULT_COLUMN_REGISTRY.filter((entry) => entry.enabled).map((entry) => ({
    id: entry.key,
    label: entry.label,
    sortField: entry.sortField,
    width: entry.width,
  }));

  cachedDefault = {
    formTabsReady: true,
    enabledTabIds: resolveContactEnabledTabIds(
      { formTabs: DEFAULT_FORM_TABS, enabledTabs: [] },
      "admin",
    ),
    requiredTabIds: new Set(["basic"]),
    fields: INITIAL_FIELD_SEED,
    formTabs: DEFAULT_FORM_TABS,
    isTabFieldEnabled: (tabId: string, fieldId: string) => {
      const tabFields = INITIAL_FIELD_SEED[tabId];
      if (!tabFields) return true;
      const field = tabFields.find((f) => f.key === fieldId);
      return field?.enabled ?? true;
    },
    isTabFieldRequired: (tabId: string, fieldId: string) => {
      const tabFields = INITIAL_FIELD_SEED[tabId];
      if (!tabFields) return false;
      const field = tabFields.find((f) => f.key === fieldId);
      return field?.required ?? false;
    },
    prefs,
    updateConfig: () => {},
    updateConfigAsync: async () => {},
    updatePrefs: () => {},
    updatePrefsAsync: async () => {},
    genders: seeded.genders,
    socialPlatforms: seeded.socialPlatforms,
    relationships,
    phoneLabels: seeded.phoneLabels,
    emailLabels: seeded.emailLabels,
    addressLabels: seeded.addressLabels,
    countryCodes: seeded.countryCodes,
    countryCodesMap,
    educationDegrees: seeded.educationDegrees,
    employmentTypes: seeded.employmentTypes,
    skillCategories: seeded.skillCategories,
    skillProficiencies: seeded.skillProficiencies,
    bankNames: seeded.bankNames,
    tags: seeded.tags,
    lookupsLoading: false,
    lookupsError: null,
    defaultPhoneCountryCode: getFallbackCountryCode(prefs, countryCodesMap, seeded.countryCodes),
    columnRegistry: DEFAULT_COLUMN_REGISTRY,
    availableColumns,
    visibleColumns,
    updateGenders: () => {},
    updateSocialPlatforms: () => {},
    updateRelationships: () => {},
    updatePhoneLabels: () => {},
    updateEmailLabels: () => {},
    updateAddressLabels: () => {},
    updateEducationDegrees: () => {},
    updateEmploymentTypes: () => {},
    updateSkillCategories: () => {},
    updateSkillProficiencies: () => {},
    updateBankNames: () => {},
    updateTags: () => {},
    updateCountryCodes: () => {},
    updateUserColumnLayout: () => {},
    isColumnVisible: (key: string) =>
      DEFAULT_COLUMN_REGISTRY.find((c) => c.key === key)?.enabled ?? false,
    getColumnWidth: (key: string) => DEFAULT_COLUMN_REGISTRY.find((c) => c.key === key)?.width,
    setColumnWidth: () => {},
    systemSortOptions: [],
  };

  return cachedDefault;
}
