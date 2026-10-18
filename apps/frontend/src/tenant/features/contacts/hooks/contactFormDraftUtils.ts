import {
  cleanContactDraft,
  normalizeContactForEdit,
  type Contact,
  type ContactItemNormalizeDefaults,
} from "@mms/shared";

export function contactDraftSnapshot(draft: Partial<Contact>): string {
  return JSON.stringify(cleanContactDraft(draft));
}

/** Ensure Social / Relationship tabs open with one editable row (zero-click). */
function withEmptyCollectionRows(
  draft: Partial<Contact>,
  socialPlatforms: string[],
  relationshipOptions: string[],
): Partial<Contact> {
  const socials = draft.socials ?? [];
  const relationshipContacts = draft.relationshipContacts ?? [];
  return {
    ...draft,
    socials: socials.length > 0 ? socials : [{ platform: socialPlatforms[0] ?? "", url: "" }],
    relationshipContacts:
      relationshipContacts.length > 0
        ? relationshipContacts
        : [{ relationship: relationshipOptions[0] ?? "", contactId: "" }],
  };
}

export function buildOptionDefaults({
  phoneLabels,
  emailLabels,
  addressLabels,
  socialPlatforms,
  relationshipOptions,
  educationDegrees,
  employmentTypes,
  skillCategories,
  skillProficiencies,
  defaultPhoneCountryCode,
}: {
  phoneLabels: string[];
  emailLabels: string[];
  addressLabels: string[];
  socialPlatforms: string[];
  relationshipOptions: string[];
  educationDegrees?: string[];
  employmentTypes?: string[];
  skillCategories?: string[];
  skillProficiencies?: string[];
  defaultPhoneCountryCode: string;
}): ContactItemNormalizeDefaults {
  return {
    phoneLabel: phoneLabels[0],
    emailLabel: emailLabels[0],
    addressLabel: addressLabels[0],
    socialPlatform: socialPlatforms[0],
    educationDegree: educationDegrees?.[0],
    employmentType: employmentTypes?.[0],
    skillCategory: skillCategories?.[0],
    skillProficiency: skillProficiencies?.[0],
    relationship: relationshipOptions[0] ?? "",
    defaultPhoneCountryCode,
  };
}

export function buildInitialContactDraft({
  contact,
  initialDraft,
  defaultCity,
  defaultProvince,
  defaultCountry,
  optionDefaults,
  socialPlatforms,
  relationshipOptions,
}: {
  contact?: Contact;
  initialDraft?: Partial<Contact>;
  defaultCity: string;
  defaultProvince: string;
  defaultCountry: string;
  optionDefaults: ContactItemNormalizeDefaults;
  socialPlatforms: string[];
  relationshipOptions: string[];
}): Partial<Contact> {
  return withEmptyCollectionRows(
    normalizeContactForEdit(
      contact,
      initialDraft,
      defaultCity,
      defaultProvince,
      defaultCountry,
      optionDefaults,
    ),
    socialPlatforms,
    relationshipOptions,
  );
}
