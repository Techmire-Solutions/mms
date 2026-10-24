import type {
  ColumnRegistryEntry,
  ContactPreferences,
  FieldConfig,
  FieldDefinition,
  TabDefinition,
} from "@mms/shared";
import type { ContactsColumnConfig } from "./contactConfigContextTypes";

export type { ContactsColumnConfig };

/** Extra state Contacts layers on top of the standard-module config core. */
export type ContactConfigExtras = {
  // ── Preferences & Tabs ──────────────────────────────────────────────────────
  prefs: ContactPreferences;
  updatePrefs: (newPrefs: Partial<ContactPreferences>) => void;
  updatePrefsAsync: (newPrefs: Partial<ContactPreferences>) => Promise<void>;
  formTabsReady: boolean;
  enabledTabIds: Set<string>;
  requiredTabIds: Set<string>;
  fields: Record<string, FieldDefinition[]>;
  formTabs?: TabDefinition[];
  isTabFieldEnabled: (tabId: string, fieldId: string) => boolean;
  isTabFieldRequired: (tabId: string, fieldId: string) => boolean;

  // ── Lookups & Catalogs ──────────────────────────────────────────────────────
  genders: string[];
  socialPlatforms: string[];
  relationships: string[];
  phoneLabels: string[];
  emailLabels: string[];
  addressLabels: string[];
  countryCodes: Array<{ country: string; code: string }>;
  countryCodesMap: Record<string, string>;
  educationDegrees: string[];
  employmentTypes: string[];
  skillCategories: string[];
  skillProficiencies: string[];
  bankNames: string[];
  tags: string[];
  lookupsReady: boolean;
  lookupsLoading: boolean;
  lookupsError: Error | null;
  reloadCollections: () => void;
  updateGenders: (genderOptions: string[]) => void | Promise<void>;
  updateSocialPlatforms: (socialPlatformOptions: string[]) => void | Promise<void>;
  updateRelationships: (relationshipOptions: string[]) => void | Promise<void>;
  updatePhoneLabels: (phoneLabelOptions: string[]) => void | Promise<void>;
  updateEmailLabels: (emailLabelOptions: string[]) => void | Promise<void>;
  updateAddressLabels: (addressLabelOptions: string[]) => void | Promise<void>;
  updateCountryCodes: (
    countryCodeOptions: Array<{ country: string; code: string }>,
  ) => void | Promise<void>;
  updateEducationDegrees: (educationDegreeOptions: string[]) => void | Promise<void>;
  updateEmploymentTypes: (employmentTypeOptions: string[]) => void | Promise<void>;
  updateSkillCategories: (skillCategoryOptions: string[]) => void | Promise<void>;
  updateSkillProficiencies: (skillProficiencyOptions: string[]) => void | Promise<void>;
  updateBankNames: (bankNameOptions: string[]) => void | Promise<void>;
  updateTags: (tagOptions: string[]) => void | Promise<void>;

  // ── Column Layout & Visibility ──────────────────────────────────────────────
  columnRegistry: ColumnRegistryEntry[];
  availableColumns: ContactsColumnConfig[];
  visibleColumns: ContactsColumnConfig[];
  getColumnWidth: (key: string) => number | undefined;
  setColumnWidth: (key: string, width: number) => void;
  updateUserColumnLayout: (columnRegistry: ColumnRegistryEntry[]) => void;
  isColumnVisible: (key: string) => boolean;
  systemSortOptions: Array<{ field: string; label: string }>;

  // ── Configuration Mutations ─────────────────────────────────────────────────
  updateConfig: (nextConfig: FieldConfig) => void;
  updateConfigAsync: (nextConfig: FieldConfig) => Promise<void>;
};
