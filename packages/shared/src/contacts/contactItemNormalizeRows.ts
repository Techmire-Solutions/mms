import {
  DEFAULT_ADDRESS_LABELS,
  DEFAULT_EDUCATION_DEGREE_LABELS,
  DEFAULT_EMAIL_LABELS,
  DEFAULT_EMPLOYMENT_TYPE_LABELS,
  DEFAULT_PHONE_LABELS,
  DEFAULT_SKILL_CATEGORY_LABELS,
  DEFAULT_SKILL_PROFICIENCY_LABELS,
  SOCIAL_PLATFORMS,
  type PhoneNumber as ContactPhone,
  type EmailAddress as ContactEmail,
  type Address as ContactAddress,
  type SocialLink as ContactSocial,
  type ContactEducation,
  type ContactExperience,
  type ContactSkill,
  type RelationshipContact,
} from "./contactTypes.js";
import { parsePhoneNumber } from "../core/phoneUtils.js";
import {
  PHONE_SYSTEM_KEYS,
  EMAIL_SYSTEM_KEYS,
  ADDRESS_SYSTEM_KEYS,
  SOCIAL_SYSTEM_KEYS,
  EDUCATION_SYSTEM_KEYS,
  EXPERIENCE_SYSTEM_KEYS,
  SKILL_SYSTEM_KEYS,
  RELATIONSHIP_SYSTEM_KEYS,
} from "./contactItemNormalizeKeys.js";

/** Optional tenant/config defaults for empty-row seeding (falls back to shared DEFAULT_*). */
export interface ContactItemNormalizeDefaults {
  phoneLabel?: string;
  emailLabel?: string;
  addressLabel?: string;
  socialPlatform?: string;
  educationDegree?: string;
  employmentType?: string;
  skillCategory?: string;
  skillProficiency?: string;
  relationship?: string;
  bankLabel?: string;
  defaultPhoneCountryCode?: string;
}

function retainExtraKeys(
  obj: Record<string, unknown>,
  consumedKeys: ReadonlySet<string>,
): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (consumedKeys.has(key)) continue;
    extras[key] = value;
  }
  return extras;
}

/**
 * Normalizes a single Phone entry into a valid PhoneNumber object.
 */
export function normalizePhoneItem(
  item: unknown,
  index = 0,
  defaultCode = "",
  defaults: ContactItemNormalizeDefaults = {},
): ContactPhone {
  const resolvedDefaultCode = defaults.defaultPhoneCountryCode || defaultCode || "";
  const defaultLabel = defaults.phoneLabel || DEFAULT_PHONE_LABELS[0] || "Mobile";
  if (!item)
    return {
      label: defaultLabel,
      number: "",
      countryCode: resolvedDefaultCode,
      isPrimary: index === 0,
    };
  if (typeof item === "string") {
    const parsed = parsePhoneNumber(item.trim(), resolvedDefaultCode);
    return {
      label: defaultLabel,
      number: parsed.number || item.trim(),
      countryCode: parsed.countryCode || resolvedDefaultCode,
      isPrimary: index === 0,
    };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const rawNum = String(obj.number || obj.phone || obj.value || obj.num || "").trim();
    const label = String(obj.label || obj.type || defaultLabel).trim() || defaultLabel;
    const countryCode =
      String(obj.countryCode || obj.code || resolvedDefaultCode).trim() || resolvedDefaultCode;
    const isPrimary = typeof obj.isPrimary === "boolean" ? obj.isPrimary : index === 0;
    const rawStatus = obj.whatsappStatus;
    const whatsappStatus: ContactPhone["whatsappStatus"] =
      rawStatus === "UNCHECKED" ? "PENDING" : (rawStatus as ContactPhone["whatsappStatus"]);
    const parsed = parsePhoneNumber(rawNum, countryCode);
    return {
      ...retainExtraKeys(obj, PHONE_SYSTEM_KEYS),
      label,
      number: parsed.number || rawNum,
      countryCode: parsed.countryCode || countryCode,
      isPrimary,
      whatsappStatus,
    };
  }
  return {
    label: defaultLabel,
    number: "",
    countryCode: resolvedDefaultCode,
    isPrimary: index === 0,
  };
}

/**
 * Normalizes a single Email entry into a valid EmailAddress object.
 */
export function normalizeEmailItem(
  item: unknown,
  index = 0,
  defaults: ContactItemNormalizeDefaults = {},
): ContactEmail {
  const defaultLabel = defaults.emailLabel || DEFAULT_EMAIL_LABELS[0] || "Personal";
  if (!item) return { label: defaultLabel, address: "", isPrimary: index === 0 };
  if (typeof item === "string") {
    return { label: defaultLabel, address: item.trim(), isPrimary: index === 0 };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const address = String(obj.address || obj.email || obj.value || "").trim();
    const label = String(obj.label || obj.type || defaultLabel).trim() || defaultLabel;
    const isPrimary = typeof obj.isPrimary === "boolean" ? obj.isPrimary : index === 0;
    const isVerified = typeof obj.isVerified === "boolean" ? obj.isVerified : undefined;
    return { ...retainExtraKeys(obj, EMAIL_SYSTEM_KEYS), label, address, isPrimary, isVerified };
  }
  return { label: defaultLabel, address: "", isPrimary: index === 0 };
}

/**
 * Normalizes a single Address entry into a valid Address object.
 */
export function normalizeAddressItem(
  item: unknown,
  defaultCity = "",
  defaultProvince = "",
  defaultCountry = "",
  index = 0,
  defaults: ContactItemNormalizeDefaults = {},
): ContactAddress {
  const defaultLabel = defaults.addressLabel || DEFAULT_ADDRESS_LABELS[0] || "Home";
  if (!item) {
    return {
      label: defaultLabel,
      line1: "",
      city: defaultCity,
      state: defaultProvince,
      country: defaultCountry,
      isPrimary: index === 0,
    };
  }
  if (typeof item === "string") {
    return {
      label: defaultLabel,
      line1: item.trim(),
      city: defaultCity,
      state: defaultProvince,
      country: defaultCountry,
      isPrimary: index === 0,
    };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const line1 = String(obj.line1 || obj.address || obj.street || obj.value || "").trim();
    const city = String(obj.city || defaultCity).trim();
    const state = String(obj.state || obj.province || defaultProvince).trim();
    const country = String(obj.country || defaultCountry).trim();
    const label = String(obj.label || obj.type || defaultLabel).trim() || defaultLabel;
    const isPrimary = typeof obj.isPrimary === "boolean" ? obj.isPrimary : index === 0;
    return {
      ...retainExtraKeys(obj, ADDRESS_SYSTEM_KEYS),
      label,
      line1,
      city,
      state,
      country,
      isPrimary,
    };
  }
  return {
    label: defaultLabel,
    line1: "",
    city: defaultCity,
    state: defaultProvince,
    country: defaultCountry,
    isPrimary: index === 0,
  };
}

/**
 * Normalizes a single Social link entry into a valid SocialLink object.
 */
export function normalizeSocialItem(
  item: unknown,
  defaults: ContactItemNormalizeDefaults = {},
): ContactSocial {
  const defaultPlatform = defaults.socialPlatform || SOCIAL_PLATFORMS[0] || "Facebook";
  if (!item) return { platform: defaultPlatform, url: "" };
  if (typeof item === "string") {
    return { platform: defaultPlatform, url: item.trim() };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const url = String(obj.url || obj.link || obj.value || "").trim();
    const platform = String(obj.platform || obj.type || defaultPlatform).trim() || defaultPlatform;
    return { ...retainExtraKeys(obj, SOCIAL_SYSTEM_KEYS), platform, url };
  }
  return { platform: defaultPlatform, url: "" };
}

/**
 * Normalizes a single relationship-contact entry into a valid RelationshipContact object.
 */
export function normalizeRelationshipContactItem(
  item: unknown,
  defaults: ContactItemNormalizeDefaults = {},
): RelationshipContact {
  const defaultRelationship = defaults.relationship || "Parent";
  if (!item) return { relationship: defaultRelationship, contactId: "" };
  if (typeof item === "string" || typeof item === "number") {
    return { relationship: defaultRelationship, contactId: String(item) };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const contactId = String(obj.contactId || obj.id || obj.targetId || "").trim();
    const relationship =
      String(obj.relationship || obj.relation || obj.type || defaultRelationship).trim() ||
      defaultRelationship;
    const name =
      typeof obj.name === "string" && obj.name.trim().length > 0 ? obj.name.trim() : undefined;
    const phone =
      typeof obj.phone === "string" && obj.phone.trim().length > 0 ? obj.phone.trim() : undefined;
    const inferred = typeof obj.inferred === "boolean" ? obj.inferred : undefined;
    const inferredFromContactId =
      obj.inferredFromContactId != null && String(obj.inferredFromContactId).trim().length > 0
        ? String(obj.inferredFromContactId).trim()
        : undefined;
    const inferenceDepth = typeof obj.inferenceDepth === "number" ? obj.inferenceDepth : undefined;

    return {
      ...retainExtraKeys(obj, RELATIONSHIP_SYSTEM_KEYS),
      relationship,
      contactId,
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(inferred !== undefined ? { inferred } : {}),
      ...(inferredFromContactId ? { inferredFromContactId } : {}),
      ...(inferenceDepth !== undefined ? { inferenceDepth } : {}),
    };
  }
  return { relationship: defaultRelationship, contactId: "" };
}

/**
 * Normalizes a single Education entry into a valid ContactEducation object.
 */
export function normalizeEducationItem(
  item: unknown,
  defaults: ContactItemNormalizeDefaults = {},
): ContactEducation {
  const defaultDegree =
    defaults.educationDegree || DEFAULT_EDUCATION_DEGREE_LABELS[0] || "Matric / Secondary";
  if (!item) {
    return {
      degree: defaultDegree,
      institution: "",
      fieldOfStudy: "",
      year: "",
      grade: "",
    };
  }
  if (typeof item === "string") {
    return {
      degree: defaultDegree,
      institution: item.trim(),
      fieldOfStudy: "",
      year: "",
      grade: "",
    };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const degree =
      String(obj.degree || obj.label || obj.type || defaultDegree).trim() || defaultDegree;
    const institution = String(
      obj.institution || obj.school || obj.college || obj.university || obj.value || "",
    ).trim();
    const fieldOfStudy = String(obj.fieldOfStudy || obj.major || obj.subject || "").trim();
    const isCurrentlyEnrolled =
      typeof obj.isCurrentlyEnrolled === "boolean"
        ? obj.isCurrentlyEnrolled
        : obj.isCurrent === true || obj.enrolled === true;
    const year = isCurrentlyEnrolled
      ? ""
      : String(obj.year || obj.passingYear || obj.graduationYear || "").trim();
    const grade = String(obj.grade || obj.division || obj.score || obj.marks || "").trim();
    return {
      ...retainExtraKeys(obj, EDUCATION_SYSTEM_KEYS),
      degree,
      institution,
      fieldOfStudy,
      year,
      grade,
      ...(isCurrentlyEnrolled ? { isCurrentlyEnrolled: true } : {}),
    };
  }
  return {
    degree: defaultDegree,
    institution: "",
    fieldOfStudy: "",
    year: "",
    grade: "",
  };
}

/**
 * Normalizes a single Experience entry into a valid ContactExperience object.
 */
export function normalizeExperienceItem(
  item: unknown,
  defaults: ContactItemNormalizeDefaults = {},
): ContactExperience {
  const defaultEmploymentType =
    defaults.employmentType || DEFAULT_EMPLOYMENT_TYPE_LABELS[0] || "Full-time";
  if (!item) {
    return {
      title: "",
      organization: "",
      employmentType: defaultEmploymentType,
      location: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      description: "",
    };
  }
  if (typeof item === "string") {
    return {
      title: item.trim(),
      organization: "",
      employmentType: defaultEmploymentType,
      location: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      description: "",
    };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const title = String(
      obj.title || obj.jobTitle || obj.role || obj.designation || obj.value || "",
    ).trim();
    const organization = String(
      obj.organization || obj.company || obj.employer || obj.madrasa || "",
    ).trim();
    const employmentType =
      String(obj.employmentType || obj.type || defaultEmploymentType).trim() ||
      defaultEmploymentType;
    const location = String(obj.location || obj.city || "").trim();
    const startDate = String(obj.startDate || obj.from || "").trim();
    const endDate = String(obj.endDate || obj.to || "").trim();
    const isCurrent = typeof obj.isCurrent === "boolean" ? obj.isCurrent : Boolean(obj.current);
    const description = String(obj.description || obj.notes || obj.responsibilities || "").trim();
    return {
      ...retainExtraKeys(obj, EXPERIENCE_SYSTEM_KEYS),
      title,
      organization,
      employmentType,
      location,
      startDate,
      endDate,
      isCurrent,
      description,
    };
  }
  return {
    title: "",
    organization: "",
    employmentType: defaultEmploymentType,
    location: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    description: "",
  };
}

/**
 * Normalizes a single Skill entry into a valid ContactSkill object.
 */
export function normalizeSkillItem(
  item: unknown,
  defaults: ContactItemNormalizeDefaults = {},
): ContactSkill {
  const defaultCategory =
    defaults.skillCategory || DEFAULT_SKILL_CATEGORY_LABELS[0] || "Islamic Studies";
  const defaultProficiency =
    defaults.skillProficiency || DEFAULT_SKILL_PROFICIENCY_LABELS[1] || "Intermediate";
  if (!item) {
    return {
      name: "",
      category: defaultCategory,
      proficiency: defaultProficiency,
      yearsOfExperience: "",
      isCertified: false,
      issuer: "",
      description: "",
    };
  }
  if (typeof item === "string") {
    return {
      name: item.trim(),
      category: defaultCategory,
      proficiency: defaultProficiency,
      yearsOfExperience: "",
      isCertified: false,
      issuer: "",
      description: "",
    };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const name = String(obj.name || obj.skill || obj.title || obj.value || "").trim();
    const category = String(obj.category || obj.type || defaultCategory).trim() || defaultCategory;
    const proficiency =
      String(obj.proficiency || obj.level || defaultProficiency).trim() || defaultProficiency;
    const yearsOfExperience = String(
      obj.yearsOfExperience || obj.years || obj.experienceYears || "",
    ).trim();
    const isCertified =
      typeof obj.isCertified === "boolean" ? obj.isCertified : Boolean(obj.certified);
    const issuer = String(obj.issuer || obj.institution || obj.board || "").trim();
    const description = String(obj.description || obj.notes || obj.details || "").trim();
    return {
      ...retainExtraKeys(obj, SKILL_SYSTEM_KEYS),
      name,
      category,
      proficiency,
      yearsOfExperience,
      isCertified,
      issuer,
      description,
    };
  }
  return {
    name: "",
    category: defaultCategory,
    proficiency: defaultProficiency,
    yearsOfExperience: "",
    isCertified: false,
    issuer: "",
    description: "",
  };
}
