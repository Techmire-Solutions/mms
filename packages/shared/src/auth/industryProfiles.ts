/**
 * @file industryProfiles.ts
 * @description Typed industry profiles and independent recommendation resolvers.
 */

import type { AppTranslationKey } from "../i18n/appTranslations.js";
import { type IndustryType } from "./industryTypes.js";

/** Industry terminology as i18n keys (resolved at the UI boundary). */
export interface TerminologyProfile {
  facultyLabelKey: AppTranslationKey;
  staffSingularKey: AppTranslationKey;
  studentLabelKey: AppTranslationKey;
  locationLabelKey: AppTranslationKey;
}

export interface IndustryProfile {
  id: IndustryType;
  displayNameKey: AppTranslationKey;
  descriptionKey: AppTranslationKey;
  recommendedModules: readonly string[];
  recommendedRoles: readonly string[];
  terminology: TerminologyProfile;
}

const COMMON_BUSINESS_MODULES = [
  "dashboard",
  "contacts",
  "faculty",
  "tasks",
  "attendance",
  "finance",
  "accounting",
  "messaging",
  "users",
] as const;

export const INDUSTRY_PROFILES: Record<IndustryType, IndustryProfile> = {
  madrasa: {
    id: "madrasa",
    displayNameKey: "organization.industry.madrasa",
    descriptionKey: "organization.industry.madrasaDesc",
    recommendedModules: [
      "dashboard",
      "contacts",
      "messaging",
      "tasks",
      "students",
      "faculty",
      "sessions",
      "attendance",
      "enrollment",
      "hasanat",
      "examination",
      "questionBank",
      "finance",
      "accounting",
      "obligations",
      "users",
    ],
    recommendedRoles: ["mohtamim", "nazim_taleemat", "ustad", "accountant", "admin"],
    terminology: {
      facultyLabelKey: "organization.terminology.madrasa.facultyLabel",
      staffSingularKey: "organization.terminology.madrasa.staffSingular",
      studentLabelKey: "organization.terminology.madrasa.studentLabel",
      locationLabelKey: "organization.terminology.madrasa.locationLabel",
    },
  },
  hotel: {
    id: "hotel",
    displayNameKey: "organization.industry.hotel",
    descriptionKey: "organization.industry.hotelDesc",
    recommendedModules: COMMON_BUSINESS_MODULES,
    recommendedRoles: ["general_manager", "department_head", "supervisor", "staff", "admin"],
    terminology: {
      facultyLabelKey: "organization.terminology.hotel.facultyLabel",
      staffSingularKey: "organization.terminology.hotel.staffSingular",
      studentLabelKey: "organization.terminology.hotel.studentLabel",
      locationLabelKey: "organization.terminology.hotel.locationLabel",
    },
  },
  office: {
    id: "office",
    displayNameKey: "organization.industry.office",
    descriptionKey: "organization.industry.officeDesc",
    recommendedModules: COMMON_BUSINESS_MODULES,
    recommendedRoles: ["executive", "team_lead", "team_member", "admin"],
    terminology: {
      facultyLabelKey: "organization.terminology.office.facultyLabel",
      staffSingularKey: "organization.terminology.office.staffSingular",
      studentLabelKey: "organization.terminology.office.studentLabel",
      locationLabelKey: "organization.terminology.office.locationLabel",
    },
  },
  retail: {
    id: "retail",
    displayNameKey: "organization.industry.retail",
    descriptionKey: "organization.industry.retailDesc",
    recommendedModules: COMMON_BUSINESS_MODULES,
    recommendedRoles: ["store_manager", "inventory_lead", "cashier", "admin"],
    terminology: {
      facultyLabelKey: "organization.terminology.retail.facultyLabel",
      staffSingularKey: "organization.terminology.retail.staffSingular",
      studentLabelKey: "organization.terminology.retail.studentLabel",
      locationLabelKey: "organization.terminology.retail.locationLabel",
    },
  },
  custom: {
    id: "custom",
    displayNameKey: "organization.industry.custom",
    descriptionKey: "organization.industry.customDesc",
    recommendedModules: ["dashboard", "contacts", "messaging", "tasks", "faculty", "users"],
    recommendedRoles: ["manager", "staff", "admin"],
    terminology: {
      facultyLabelKey: "organization.terminology.custom.facultyLabel",
      staffSingularKey: "organization.terminology.custom.staffSingular",
      studentLabelKey: "organization.terminology.custom.studentLabel",
      locationLabelKey: "organization.terminology.custom.locationLabel",
    },
  },
  general: {
    id: "general",
    displayNameKey: "organization.industry.general",
    descriptionKey: "organization.industry.generalDesc",
    recommendedModules: ["dashboard", "contacts", "messaging", "tasks", "faculty", "users"],
    recommendedRoles: ["manager", "staff", "admin"],
    terminology: {
      facultyLabelKey: "organization.terminology.general.facultyLabel",
      staffSingularKey: "organization.terminology.general.staffSingular",
      studentLabelKey: "organization.terminology.general.studentLabel",
      locationLabelKey: "organization.terminology.general.locationLabel",
    },
  },
};

export function getIndustryProfile(industry?: IndustryType | string | null): IndustryProfile {
  if (industry && industry in INDUSTRY_PROFILES) {
    return INDUSTRY_PROFILES[industry as IndustryType];
  }
  return INDUSTRY_PROFILES.madrasa;
}

export function getRecommendedModulesForIndustry(
  industry?: IndustryType | string | null,
): readonly string[] {
  return getIndustryProfile(industry).recommendedModules;
}

export function getTerminologyForIndustry(
  industry?: IndustryType | string | null,
): TerminologyProfile {
  return getIndustryProfile(industry).terminology;
}

/**
 * Advisory role labels for onboarding/setup UI only.
 * These are NOT auto-seeded into `DEFAULT_WORKSPACE_ROLES` — industry catalog IDs
 * (e.g. `general_manager`) do not map 1:1 to workspace RBAC role IDs.
 */
export function getRecommendedRolesForIndustry(
  industry?: IndustryType | string | null,
): readonly string[] {
  return getIndustryProfile(industry).recommendedRoles;
}
