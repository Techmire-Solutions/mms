/** Contact form edit normalization — hydrates collections and legacy scalars. */
import {
  DEFAULT_ADDRESS_LABELS,
  DEFAULT_EMAIL_LABELS,
  DEFAULT_PHONE_LABELS,
  DEFAULT_SKILL_CATEGORY_LABELS,
  DEFAULT_SKILL_PROFICIENCY_LABELS,
  DEFAULT_BANK_LABELS,
  SOCIAL_PLATFORMS,
  type Contact,
  type PhoneNumber as ContactPhone,
  type EmailAddress as ContactEmail,
  type Address as ContactAddress,
  type SocialLink as ContactSocial,
  type ContactEducation,
  type ContactExperience,
  type ContactSkill,
  type ContactBankDetail,
  type RelationshipContact,
} from "./contactTypes.js";
import { normalizeToE164 } from "./phoneUtils.js";
import {
  normalizeAddressItem,
  normalizeEducationItem,
  normalizeExperienceItem,
  normalizeSkillItem,
  normalizeBankDetailItem,
  normalizeEmailItem,
  normalizeRelationshipContactItem,
  normalizePhoneItem,
  normalizeSocialItem,
  type ContactItemNormalizeDefaults,
} from "./contactItemNormalize.js";
import { stripContactClientSoftDeleteFields } from "./contactSoftDelete.js";
import { hydrateContactRelationshipFields } from "./contactRelationshipHydrate.js";
import { getContactTags } from "./contactEntityTypes.js";

/**
 * Normalizes a full Contact object for form edit and display operations.
 * Pass `optionDefaults` from tenant ContactConfig so empty rows use dynamic lists.
 */
export function normalizeContactForEdit(
  raw: Partial<Contact> | undefined,
  initialDraft: Partial<Contact> | undefined,
  defaultCity = "",
  defaultProvince = "",
  defaultCountry = "",
  optionDefaults: ContactItemNormalizeDefaults = {},
): Partial<Contact> {
  const defaults: ContactItemNormalizeDefaults = {
    phoneLabel: optionDefaults.phoneLabel || DEFAULT_PHONE_LABELS[0] || "Mobile",
    emailLabel: optionDefaults.emailLabel || DEFAULT_EMAIL_LABELS[0] || "Personal",
    addressLabel: optionDefaults.addressLabel || DEFAULT_ADDRESS_LABELS[0] || "Home",
    socialPlatform: optionDefaults.socialPlatform || SOCIAL_PLATFORMS[0] || "Facebook",
    relationship: optionDefaults.relationship || "Parent",
    bankLabel: optionDefaults.bankLabel || DEFAULT_BANK_LABELS[0] || "Primary",
    defaultPhoneCountryCode: optionDefaults.defaultPhoneCountryCode || "",
  };
  const dialDefault = defaults.defaultPhoneCountryCode || "";

  const merged: Partial<Contact> = hydrateContactRelationshipFields({
    firstName: "",
    lastName: "",
    name: "",
    gender: "",
    dob: "",
    cnic: "",
    isSyed: false,
    notes: "",
    phones: [],
    emails: [],
    addresses: [],
    socials: [],
    education: [],
    experience: [],
    skills: [],
    bankDetails: [],
    relationshipContacts: [],
    relationships: [],
    ...initialDraft,
    ...raw,
  });

  let firstName = (merged.firstName || "").trim();
  let lastName = (merged.lastName || "").trim();
  const fullName = (merged.name || "").trim();

  if (!firstName && fullName) {
    const parts = fullName.split(" ").filter(Boolean);
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ");
  }

  // Hydrate from legacy scalars only when the source omitted the collection array.
  const sourceHasPhonesArray = Array.isArray(raw?.phones) || Array.isArray(initialDraft?.phones);
  const sourceHasEmailsArray = Array.isArray(raw?.emails) || Array.isArray(initialDraft?.emails);
  const sourceHasAddressesArray =
    Array.isArray(raw?.addresses) || Array.isArray(initialDraft?.addresses);

  let phones: ContactPhone[] = Array.isArray(merged.phones)
    ? merged.phones.map((item, idx) => normalizePhoneItem(item, idx, dialDefault, defaults))
    : [];

  const scalarPhone =
    typeof (merged as Record<string, unknown>).phone === "string"
      ? String((merged as Record<string, unknown>).phone).trim()
      : "";
  if (scalarPhone && !sourceHasPhonesArray) {
    const e164Scalar = normalizeToE164("", scalarPhone);
    const exists = phones.some((p) => {
      const numTrim = (p.number || "").trim();
      const e164Item = normalizeToE164(p.countryCode || dialDefault, numTrim);
      return numTrim === scalarPhone || (e164Scalar && e164Item === e164Scalar);
    });
    if (!exists) {
      phones.unshift(normalizePhoneItem(scalarPhone, 0, dialDefault, defaults));
    }
  }

  if (phones.length === 0) {
    phones = [
      {
        label: defaults.phoneLabel || "Mobile",
        number: "",
        countryCode: dialDefault,
        isPrimary: true,
      },
    ];
  }

  let emails: ContactEmail[] = Array.isArray(merged.emails)
    ? merged.emails.map((item, idx) => normalizeEmailItem(item, idx, defaults))
    : [];

  const scalarEmail =
    typeof (merged as Record<string, unknown>).email === "string"
      ? String((merged as Record<string, unknown>).email).trim()
      : "";
  if (
    scalarEmail &&
    !sourceHasEmailsArray &&
    !emails.some((e) => (e.address || "").trim().toLowerCase() === scalarEmail.toLowerCase())
  ) {
    emails.unshift(normalizeEmailItem(scalarEmail, 0, defaults));
  }

  if (emails.length === 0) {
    emails = [{ label: defaults.emailLabel || "Personal", address: "", isPrimary: true }];
  }

  let addresses: ContactAddress[] = Array.isArray(merged.addresses)
    ? merged.addresses.map((item, idx) =>
        normalizeAddressItem(item, defaultCity, defaultProvince, defaultCountry, idx, defaults),
      )
    : [];

  const scalarAddress =
    typeof (merged as Record<string, unknown>).address === "string"
      ? String((merged as Record<string, unknown>).address).trim()
      : "";
  const scalarCity =
    typeof (merged as Record<string, unknown>).city === "string"
      ? String((merged as Record<string, unknown>).city).trim()
      : defaultCity;
  const scalarState =
    typeof (merged as Record<string, unknown>).state === "string"
      ? String((merged as Record<string, unknown>).state).trim()
      : defaultProvince;
  const scalarCountry =
    typeof (merged as Record<string, unknown>).country === "string"
      ? String((merged as Record<string, unknown>).country).trim()
      : defaultCountry;

  if (
    scalarAddress &&
    !sourceHasAddressesArray &&
    !addresses.some((a) => (a.line1 || "").trim() === scalarAddress)
  ) {
    addresses.unshift({
      label: defaults.addressLabel || "Home",
      line1: scalarAddress,
      city: scalarCity,
      state: scalarState,
      country: scalarCountry,
      isPrimary: true,
    });
  }

  if (addresses.length === 0) {
    addresses = [
      {
        label: defaults.addressLabel || "Home",
        line1: "",
        city: defaultCity,
        state: defaultProvince,
        country: defaultCountry,
        isPrimary: true,
      },
    ];
  }

  let socials: ContactSocial[] = Array.isArray(merged.socials)
    ? merged.socials.map((item) => normalizeSocialItem(item, defaults))
    : [];

  if (socials.length === 0) {
    socials = [{ platform: defaults.socialPlatform || "Facebook", url: "" }];
  }

  let education: ContactEducation[] = Array.isArray(merged.education)
    ? merged.education.map((item) => normalizeEducationItem(item, defaults))
    : [];

  if (education.length === 0) {
    education = [
      {
        degree: defaults.educationDegree || "Matric / Secondary",
        institution: "",
        fieldOfStudy: "",
        year: "",
        grade: "",
      },
    ];
  }

  let experience: ContactExperience[] = Array.isArray(merged.experience)
    ? merged.experience.map((item) => normalizeExperienceItem(item, defaults))
    : [];

  if (experience.length === 0) {
    experience = [
      {
        title: "",
        organization: "",
        employmentType: defaults.employmentType || "Full-time",
        location: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        description: "",
      },
    ];
  }

  let skills: ContactSkill[] = Array.isArray(merged.skills)
    ? merged.skills.map((item) => normalizeSkillItem(item, defaults))
    : [];

  if (skills.length === 0) {
    skills = [
      {
        name: "",
        category: defaults.skillCategory || DEFAULT_SKILL_CATEGORY_LABELS[0] || "Islamic Studies",
        proficiency:
          defaults.skillProficiency || DEFAULT_SKILL_PROFICIENCY_LABELS[1] || "Intermediate",
        yearsOfExperience: "",
        isCertified: false,
        issuer: "",
        description: "",
      },
    ];
  }

  let bankDetails: ContactBankDetail[] = Array.isArray(merged.bankDetails)
    ? merged.bankDetails.map((item) => normalizeBankDetailItem(item, defaults))
    : [];

  if (bankDetails.length === 0) {
    bankDetails = [
      {
        bankName: "",
        accountTitle: "",
        accountNumber: "",
      },
    ];
  }

  let relationshipContacts: RelationshipContact[] = Array.isArray(merged.relationshipContacts)
    ? merged.relationshipContacts.map((item) => normalizeRelationshipContactItem(item, defaults))
    : [];

  if (relationshipContacts.length === 0) {
    relationshipContacts = [{ relationship: defaults.relationship || "", contactId: "" }];
  }

  return {
    ...stripContactClientSoftDeleteFields(merged as Record<string, unknown>),
    firstName,
    lastName,
    name: fullName || (lastName ? `${firstName} ${lastName}`.trim() : firstName),
    phones,
    emails,
    addresses,
    socials,
    education,
    experience,
    skills,
    bankDetails,
    relationshipContacts,
    tags: getContactTags(merged),
    tag: getContactTags(merged).join(", "),
  } as Partial<Contact>;
}
