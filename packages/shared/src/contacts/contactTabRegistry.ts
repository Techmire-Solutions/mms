/** Contact form/page/detail tab defaults and column registry. */
import { DEFAULT_MODULE_TIER_TAB_LABELS } from "../settings/moduleTierTabs.js";
import type {
  ColumnRegistryEntry,
  FieldDefinition,
  TabDefinition,
} from "./contactFieldSchemaTypes.js";
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

export const DEFAULT_COLUMN_REGISTRY: ColumnRegistryEntry[] = [
  {
    key: "name",
    label: "Name",
    labelKey: "contacts.columns.name",
    enabled: true,
    order: 0,
    sortable: true,
    width: 0,
    fixed: true,
  },
  {
    key: "gender",
    label: "Gender",
    labelKey: "contacts.columns.gender",
    enabled: true,
    order: 1,
    sortable: true,
    width: 100,
  },
  {
    key: "phone",
    label: "Phone",
    labelKey: "contacts.columns.phone",
    enabled: true,
    order: 2,
    sortable: false,
    width: 140,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    labelKey: "contacts.columns.whatsapp",
    enabled: true,
    order: 3,
    sortable: false,
    width: 90,
  },
  {
    key: "email",
    label: "Email",
    labelKey: "contacts.columns.email",
    enabled: true,
    order: 4,
    sortable: false,
    width: 180,
  },
  {
    key: "isSyed",
    label: "Is Syed",
    labelKey: "contacts.columns.isSyed",
    enabled: true,
    order: 5,
    sortable: true,
    width: 90,
  },
  {
    key: "tag",
    label: "Tag",
    labelKey: "contacts.columns.tag",
    enabled: true,
    order: 6,
    sortable: true,
    width: 120,
  },
  {
    key: "dob",
    label: "Date of Birth",
    labelKey: "contacts.columns.dob",
    enabled: true,
    order: 7,
    sortable: true,
    width: 130,
  },
  {
    key: "lunarDob",
    label: "Lunar DOB",
    labelKey: "contacts.columns.lunarDob",
    enabled: true,
    order: 8,
    sortable: true,
    sortField: "dob",
    width: 150,
  },
  {
    key: "cnic",
    label: "CNIC / National ID",
    labelKey: "contacts.columns.cnic",
    enabled: false,
    order: 9,
    sortable: true,
    width: 140,
  },
  {
    key: "line1",
    label: "Street Address",
    labelKey: "contacts.columns.streetAddress",
    enabled: false,
    order: 10,
    sortable: true,
    width: 150,
  },
  {
    key: "city",
    label: "City",
    labelKey: "contacts.columns.city",
    enabled: true,
    order: 11,
    sortable: true,
    width: 110,
  },
  {
    key: "state",
    label: "State / Province",
    labelKey: "contacts.columns.state",
    enabled: false,
    order: 12,
    sortable: true,
    width: 120,
  },
  {
    key: "country",
    label: "Country",
    labelKey: "contacts.columns.country",
    enabled: false,
    order: 13,
    sortable: true,
    width: 110,
  },
  {
    key: "socials_platform",
    label: "Social Platforms",
    labelKey: "contacts.columns.socialPlatforms",
    enabled: false,
    order: 14,
    sortable: false,
    width: 130,
  },
  {
    key: "socials_url",
    label: "Social Links",
    labelKey: "contacts.columns.socialLinks",
    enabled: false,
    order: 15,
    sortable: false,
    width: 150,
  },
  {
    key: "education_degree",
    label: "Degree",
    labelKey: "contacts.columns.educationDegree",
    enabled: false,
    order: 16,
    sortable: false,
    width: 140,
  },
  {
    key: "education_institution",
    label: "Institution",
    labelKey: "contacts.columns.educationInstitution",
    enabled: false,
    order: 17,
    sortable: false,
    width: 160,
  },
  {
    key: "education_fieldOfStudy",
    label: "Field of Study",
    labelKey: "contacts.columns.educationFieldOfStudy",
    enabled: false,
    order: 18,
    sortable: false,
    width: 150,
  },
  {
    key: "education_year",
    label: "Graduation Year",
    labelKey: "contacts.columns.educationYear",
    enabled: false,
    order: 19,
    sortable: false,
    width: 130,
  },
  {
    key: "education_grade",
    label: "Grade / Division",
    labelKey: "contacts.columns.educationGrade",
    enabled: false,
    order: 20,
    sortable: false,
    width: 130,
  },
  {
    key: "experience_title",
    label: "Job Title",
    labelKey: "contacts.columns.experienceTitle",
    enabled: false,
    order: 21,
    sortable: false,
    width: 150,
  },
  {
    key: "experience_organization",
    label: "Organization",
    labelKey: "contacts.columns.experienceOrganization",
    enabled: false,
    order: 22,
    sortable: false,
    width: 160,
  },
  {
    key: "experience_employmentType",
    label: "Employment Type",
    labelKey: "contacts.columns.experienceEmploymentType",
    enabled: false,
    order: 23,
    sortable: false,
    width: 140,
  },
  {
    key: "experience_location",
    label: "Job Location",
    labelKey: "contacts.columns.experienceLocation",
    enabled: false,
    order: 24,
    sortable: false,
    width: 140,
  },
  {
    key: "skills",
    label: "Skills",
    labelKey: "contacts.columns.skills",
    enabled: false,
    order: 25,
    sortable: false,
    width: 160,
  },
  {
    key: "skills_name",
    label: "Skill Name",
    labelKey: "contacts.columns.skillsName",
    enabled: false,
    order: 26,
    sortable: false,
    width: 140,
  },
  {
    key: "skills_category",
    label: "Skill Category",
    labelKey: "contacts.columns.skillsCategory",
    enabled: false,
    order: 27,
    sortable: false,
    width: 150,
  },
  {
    key: "skills_proficiency",
    label: "Skill Proficiency",
    labelKey: "contacts.columns.skillsProficiency",
    enabled: false,
    order: 28,
    sortable: false,
    width: 140,
  },
  {
    key: "skills_yearsOfExperience",
    label: "Years of Experience",
    labelKey: "contacts.columns.skillsYearsOfExperience",
    enabled: false,
    order: 29,
    sortable: false,
    width: 140,
  },
  {
    key: "skills_isCertified",
    label: "Certified / Ijazah",
    labelKey: "contacts.columns.skillsIsCertified",
    enabled: false,
    order: 30,
    sortable: false,
    width: 130,
  },
  {
    key: "skills_issuer",
    label: "Certifying Body / Issuer",
    labelKey: "contacts.columns.skillsIssuer",
    enabled: false,
    order: 31,
    sortable: false,
    width: 160,
  },
  {
    key: "relationship_contact",
    label: "Relationship Contact",
    labelKey: "contacts.columns.relationshipContact",
    enabled: false,
    order: 32,
    sortable: false,
    width: 150,
  },
  {
    key: "relationship_type",
    label: "Relationship Type",
    labelKey: "contacts.columns.relationshipType",
    enabled: false,
    order: 33,
    sortable: false,
    width: 140,
  },
  {
    key: "notes",
    label: "Notes",
    labelKey: "contacts.columns.notes",
    enabled: false,
    order: 34,
    sortable: false,
    width: 180,
  },
  {
    key: "bank_name",
    label: "Bank Name",
    labelKey: "contacts.columns.bankName",
    enabled: false,
    order: 35,
    sortable: false,
    width: 140,
  },
  {
    key: "bank_account",
    label: "Account Number",
    labelKey: "contacts.columns.accountNumber",
    enabled: false,
    order: 36,
    sortable: false,
    width: 150,
  },
  {
    key: "bank_iban",
    label: "IBAN",
    labelKey: "contacts.columns.iban",
    enabled: false,
    order: 37,
    sortable: false,
    width: 160,
  },
];

export { COLUMN_FIELD_MAPPING } from "./contactColumnFieldMapping.js";
