/** Contact form/page/detail tab defaults and column registry. */
import { DEFAULT_MODULE_TIER_TAB_LABELS } from "../settings/moduleTierTabs.js";
import type { FieldDefinition, TabDefinition } from "./contactFieldSchemaTypes.js";
import { CONTACT_RETIRED_CLASSIFICATION_KEYS } from "./contactRetiredFields.js";

/**
 * Field keys retired from the contact **form** registry. They may still exist on
 * stored `Contact` JSONB blobs, but must never be re-rendered as form inputs.
 * `sanitizeConfig` strips these from any persisted field config.
 */
export const REMOVED_FORM_FIELD_KEYS: readonly string[] = [
  "countryCode",
  ...CONTACT_RETIRED_CLASSIFICATION_KEYS,
  "rating",
  "notes",
  "occupation",
  "communicationPreference",
  "phone",
  "email",
  "iban",
  "swiftCode",
  "branchName",
  "branchCode",
  "routingNumber",
  "currency",
];

export const DEFAULT_PAGE_TABS: TabDefinition[] = [
  {
    key: "work",
    label: DEFAULT_MODULE_TIER_TAB_LABELS.work,
    enabled: true,
    order: 0,
    isSystem: true,
  },
  {
    key: "reports",
    label: DEFAULT_MODULE_TIER_TAB_LABELS.reports,
    enabled: true,
    order: 1,
    isSystem: true,
  },
  {
    key: "setup",
    label: DEFAULT_MODULE_TIER_TAB_LABELS.setup,
    enabled: true,
    order: 2,
    isSystem: true,
  },
];

/**
 * Retired seed form tab for scalar fields formerly dumped under `tabId: "custom"`.
 * Not in {@link DEFAULT_FORM_TABS}; only shown when field-config still has fields there.
 * New extras use `+ Add custom tab` (`custom_*` collection tabs).
 */
export const CONTACT_LEGACY_CUSTOM_FORM_TAB_KEY = "custom" as const;

export const CONTACT_LEGACY_CUSTOM_FORM_TAB: TabDefinition = {
  key: CONTACT_LEGACY_CUSTOM_FORM_TAB_KEY,
  label: "Custom",
  labelKey: "contacts.form.tabCustom",
  enabled: true,
  order: 6,
  isSystem: true,
};

export const DEFAULT_FORM_TABS: TabDefinition[] = [
  {
    key: "basic",
    label: "Identity",
    labelKey: "contacts.form.tabBasic",
    enabled: true,
    order: 0,
    isSystem: true,
  },
  {
    key: "phones",
    label: "Phones",
    labelKey: "contacts.form.tabPhones",
    enabled: true,
    order: 1,
    isSystem: true,
  },
  {
    key: "emails",
    label: "Emails",
    labelKey: "contacts.form.tabEmails",
    enabled: true,
    order: 2,
    isSystem: true,
  },
  {
    key: "addresses",
    label: "Addresses",
    labelKey: "contacts.form.tabAddresses",
    enabled: true,
    order: 3,
    isSystem: true,
  },
  {
    key: "socials",
    label: "Socials",
    labelKey: "contacts.form.tabSocials",
    enabled: true,
    order: 4,
    isSystem: true,
  },
  {
    key: "education",
    label: "Education",
    labelKey: "contacts.form.tabEducation",
    enabled: true,
    order: 5,
    isSystem: true,
  },
  {
    key: "experience",
    label: "Experience",
    labelKey: "contacts.form.tabExperience",
    enabled: true,
    order: 6,
    isSystem: true,
  },
  {
    key: "skills",
    label: "Skills",
    labelKey: "contacts.form.tabSkills",
    enabled: true,
    order: 7,
    isSystem: true,
  },
  {
    key: "relationship",
    label: "Relationship",
    labelKey: "contacts.form.tabRelationship",
    enabled: true,
    order: 8,
    isSystem: true,
  },
  {
    key: "bankDetails",
    label: "Bank Details",
    labelKey: "contacts.form.tabBankDetails",
    enabled: true,
    order: 9,
    isSystem: true,
  },
];

/** Seed form tab definition when present in defaults or legacy `custom`. */
export function getContactSeedFormTab(tabKey: string): TabDefinition | undefined {
  const key = tabKey.toLowerCase();
  if (key === CONTACT_LEGACY_CUSTOM_FORM_TAB_KEY) return CONTACT_LEGACY_CUSTOM_FORM_TAB;
  return DEFAULT_FORM_TABS.find((tab) => tab.key.toLowerCase() === key);
}

/** True when `fields` has at least one definition under `tabKey` (case-insensitive). */
export function contactFieldsMapHasTabFields(
  fields: Record<string, FieldDefinition[]> | undefined,
  tabKey: string,
): boolean {
  if (!fields) return false;
  const lower = tabKey.toLowerCase();
  for (const [key, list] of Object.entries(fields)) {
    if (key.toLowerCase() === lower && Array.isArray(list) && list.length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Drops the retired seed `custom` form tab unless field-config still stores fields there.
 * Normalizes legacy label/labelKey when the tab is kept.
 */
export function omitContactLegacyCustomFormTabUnlessUsed(
  formTabs: TabDefinition[],
  fields?: Record<string, FieldDefinition[]> | undefined,
): TabDefinition[] {
  const keepLegacy = contactFieldsMapHasTabFields(fields, CONTACT_LEGACY_CUSTOM_FORM_TAB_KEY);
  return formTabs
    .filter((tab) => {
      if (tab.key.toLowerCase() !== CONTACT_LEGACY_CUSTOM_FORM_TAB_KEY) return true;
      return keepLegacy;
    })
    .map((tab) => {
      if (tab.key.toLowerCase() !== CONTACT_LEGACY_CUSTOM_FORM_TAB_KEY) return tab;
      return {
        ...tab,
        label: CONTACT_LEGACY_CUSTOM_FORM_TAB.label,
        labelKey: CONTACT_LEGACY_CUSTOM_FORM_TAB.labelKey,
        isSystem: true,
      };
    });
}

export const DEFAULT_DETAIL_TABS: TabDefinition[] = [
  {
    key: "overview",
    label: "Overview",
    labelKey: "contacts.detail.tabOverview",
    enabled: true,
    order: 0,
    isSystem: true,
  },
  {
    key: "timeline",
    label: "Timeline",
    labelKey: "contacts.detail.tabTimeline",
    enabled: true,
    order: 1,
    isSystem: true,
  },
  {
    key: "files",
    label: "Files",
    labelKey: "contacts.detail.tabFiles",
    enabled: true,
    order: 2,
    isSystem: true,
  },
];

export const DEFAULT_SETTINGS_SUB_TABS: TabDefinition[] = [
  {
    key: "preferences",
    label: "Preferences",
    labelKey: "contacts.setup.preferences",
    enabled: true,
    order: 0,
    isSystem: true,
  },
  {
    key: "sync",
    label: "Sync (Google / Apple)",
    labelKey: "contacts.setup.sync",
    enabled: true,
    order: 1,
    isSystem: true,
  },
];

export { DEFAULT_COLUMN_REGISTRY } from "./contactColumnRegistry.js";

export { COLUMN_FIELD_MAPPING } from "./contactColumnFieldMapping.js";
