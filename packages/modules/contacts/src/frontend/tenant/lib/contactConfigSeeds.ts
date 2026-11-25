import {
  GENDERS,
  SOCIAL_PLATFORMS,
  DEFAULT_PHONE_LABELS,
  DEFAULT_EMAIL_LABELS,
  DEFAULT_ADDRESS_LABELS,
  DEFAULT_BANK_NAMES,
  DEFAULT_EDUCATION_DEGREE_LABELS,
  DEFAULT_EMPLOYMENT_TYPE_LABELS,
  DEFAULT_SKILL_CATEGORY_LABELS,
  DEFAULT_SKILL_PROFICIENCY_LABELS,
  DEFAULT_TAG_LABELS,
  COUNTRY_CODES,
  RELATIONSHIPS,
} from "@mms/contracts";

/** Seeds Setup option collections from shared DEFAULT_* constants (SSOT). */
export function getContactConfigCollectionDefaults(): {
  genders: string[];
  socialPlatforms: string[];
  relationships: string[];
  phoneLabels: string[];
  emailLabels: string[];
  addressLabels: string[];
  countryCodes: Array<{ country: string; code: string }>;
  educationDegrees: string[];
  employmentTypes: string[];
  skillCategories: string[];
  skillProficiencies: string[];
  bankNames: string[];
  tags: string[];
} {
  return {
    genders: [...GENDERS],
    socialPlatforms: [...SOCIAL_PLATFORMS],
    relationships: [...RELATIONSHIPS],
    phoneLabels: [...DEFAULT_PHONE_LABELS],
    emailLabels: [...DEFAULT_EMAIL_LABELS],
    addressLabels: [...DEFAULT_ADDRESS_LABELS],
    countryCodes: COUNTRY_CODES.map((entry) => ({ ...entry })),
    educationDegrees: [...DEFAULT_EDUCATION_DEGREE_LABELS],
    employmentTypes: [...DEFAULT_EMPLOYMENT_TYPE_LABELS],
    skillCategories: [...DEFAULT_SKILL_CATEGORY_LABELS],
    skillProficiencies: [...DEFAULT_SKILL_PROFICIENCY_LABELS],
    bankNames: [...DEFAULT_BANK_NAMES],
    tags: [...DEFAULT_TAG_LABELS],
  };
}
