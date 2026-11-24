/** Contact form edit sub-collection normalization (education, experience, skills, bank details, relationships). */
import {
  DEFAULT_SKILL_CATEGORY_LABELS,
  DEFAULT_SKILL_PROFICIENCY_LABELS,
  type ContactEducation,
  type ContactExperience,
  type ContactSkill,
  type ContactBankDetail,
  type RelationshipContact,
} from "./contactTypes.js";
import {
  normalizeEducationItem,
  normalizeExperienceItem,
  normalizeSkillItem,
  normalizeBankDetailItem,
  normalizeRelationshipContactItem,
  type ContactItemNormalizeDefaults,
} from "./contactItemNormalize.js";

export function normalizeEducationList(
  rawEducation: unknown,
  defaults: ContactItemNormalizeDefaults,
): ContactEducation[] {
  let education: ContactEducation[] = Array.isArray(rawEducation)
    ? rawEducation.map((item) => normalizeEducationItem(item, defaults))
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
  return education;
}

export function normalizeExperienceList(
  rawExperience: unknown,
  defaults: ContactItemNormalizeDefaults,
): ContactExperience[] {
  let experience: ContactExperience[] = Array.isArray(rawExperience)
    ? rawExperience.map((item) => normalizeExperienceItem(item, defaults))
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
  return experience;
}

export function normalizeSkillsList(
  rawSkills: unknown,
  defaults: ContactItemNormalizeDefaults,
): ContactSkill[] {
  let skills: ContactSkill[] = Array.isArray(rawSkills)
    ? rawSkills.map((item) => normalizeSkillItem(item, defaults))
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
  return skills;
}

export function normalizeBankDetailsList(
  rawBankDetails: unknown,
  defaults: ContactItemNormalizeDefaults,
): ContactBankDetail[] {
  let bankDetails: ContactBankDetail[] = Array.isArray(rawBankDetails)
    ? rawBankDetails.map((item) => normalizeBankDetailItem(item, defaults))
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
  return bankDetails;
}

export function normalizeRelationshipContactsList(
  rawRelationshipContacts: unknown,
  defaults: ContactItemNormalizeDefaults,
): RelationshipContact[] {
  let relationshipContacts: RelationshipContact[] = Array.isArray(rawRelationshipContacts)
    ? rawRelationshipContacts.map((item) => normalizeRelationshipContactItem(item, defaults))
    : [];

  if (relationshipContacts.length === 0) {
    relationshipContacts = [{ relationship: defaults.relationship || "", contactId: "" }];
  }
  return relationshipContacts;
}
