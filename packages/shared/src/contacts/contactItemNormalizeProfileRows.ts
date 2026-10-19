import {
  DEFAULT_EDUCATION_DEGREE_LABELS,
  DEFAULT_EMPLOYMENT_TYPE_LABELS,
  DEFAULT_SKILL_CATEGORY_LABELS,
  DEFAULT_SKILL_PROFICIENCY_LABELS,
  type ContactEducation,
  type ContactExperience,
  type ContactSkill,
} from "./contactTypes.js";
import {
  EDUCATION_SYSTEM_KEYS,
  EXPERIENCE_SYSTEM_KEYS,
  SKILL_SYSTEM_KEYS,
  retainExtraKeys,
} from "./contactItemNormalizeKeys.js";
import type { ContactItemNormalizeDefaults } from "./contactItemNormalizeRows.js";

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
