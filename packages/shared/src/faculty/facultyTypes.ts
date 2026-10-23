export {
  FACULTY_EMPLOYMENT_STATUS_VALUES,
  FACULTY_STATUS_VALUES,
  FACULTY_PROFILE_STATUS_VALUES,
  FACULTY_CATALOG_STATUS_VALUES,
  FACULTY_ENDED_STATUSES,
  DEFAULT_FACULTY_STATUS,
  DEFAULT_FACULTY_PROFILE_STATUS,
  isFacultyStatus,
  isFacultyProfileStatus,
  resolveFacultyStatusRoles,
  resolveFacultyStatuses,
  resolveFacultyStatus,
  resolveFacultyProfileStatus,
  type FacultyEmploymentStatus,
  type FacultyStatus,
  type FacultyProfileStatus,
  type FacultyCatalogStatus,
  type FacultyStatusRoles,
} from "./facultyStatusTypes.js";

import type { FacultyEmployDesignationWriteRow } from "./facultyEmployDesignationTypes.js";
import type { FacultyEmploymentStatus, FacultyProfileStatus } from "./facultyStatusTypes.js";

/** Teaching specialization options for madrasa faculty. */
export const FACULTY_SPECIALIZATION_VALUES = [
  "Hifz",
  "Qaidah",
  "Tajweed",
  "Islamic Studies",
  "Arabic",
  "General",
  "Other",
] as const;
export type FacultySpecialization = (typeof FACULTY_SPECIALIZATION_VALUES)[number];

/** Prefer configured specializations; fall back to the shared default list. */
export function resolveFacultySpecializations(
  specializations?: readonly string[] | null,
): readonly string[] {
  return specializations && specializations.length > 0
    ? specializations
    : FACULTY_SPECIALIZATION_VALUES;
}

/** Academic / institutional designations for faculty members. */
export const FACULTY_DESIGNATION_VALUES = [
  "Instructor",
  "Senior Instructor",
  "Assistant Instructor",
  "Head of Department",
  "Qari",
  "Administrator",
] as const;
export type FacultyDesignation = (typeof FACULTY_DESIGNATION_VALUES)[number];

/** Prefer configured designations; fall back to the shared default list. */
export function resolveFacultyDesignations(
  designations?: readonly string[] | null,
): readonly string[] {
  return designations && designations.length > 0 ? designations : FACULTY_DESIGNATION_VALUES;
}

/** Default specialization when unset (must remain in {@link FACULTY_SPECIALIZATION_VALUES}). */
export const DEFAULT_FACULTY_SPECIALIZATION: FacultySpecialization =
  FACULTY_SPECIALIZATION_VALUES.find((value) => value === "General") ??
  FACULTY_SPECIALIZATION_VALUES[0];

/** Academic and administrative departments for madrasa faculty. */
export const FACULTY_DEPARTMENT_VALUES = [
  "Hifz",
  "Nazira",
  "Tajweed",
  "Islamic Studies",
  "Arabic",
  "Academics",
  "Administration",
] as const;
export type FacultyDepartment = (typeof FACULTY_DEPARTMENT_VALUES)[number];

/** Prefer configured departments; fall back to the shared default list. */
export function resolveFacultyDepartments(
  departments?: readonly string[] | null,
): readonly string[] {
  return departments && departments.length > 0 ? departments : FACULTY_DEPARTMENT_VALUES;
}

/** Hierarchy presets for delegation authority (lower number = higher authority). */
export interface FacultyHierarchyPreset {
  rank: number;
  label: string;
}

/** Rank presets aligned with i18n scale 1 (highest) … 10 (Lecturer/Staff). */
export const FACULTY_HIERARCHY_RANK_PRESETS: readonly FacultyHierarchyPreset[] = [
  { rank: 1, label: "Dean / Principal" },
  { rank: 2, label: "Head of Department (HoD)" },
  { rank: 3, label: "Senior Faculty / Professor" },
  { rank: 4, label: "Associate Professor" },
  { rank: 5, label: "Assistant Professor" },
  { rank: 6, label: "Senior Lecturer" },
  { rank: 7, label: "Lecturer / Instructor" },
  { rank: 8, label: "Junior Lecturer" },
  { rank: 9, label: "Teaching Assistant" },
  { rank: 10, label: "Lecturer / Staff" },
] as const;

/** Default when no designation rank is projected from primary faculty_assignments. */
export const DEFAULT_FACULTY_HIERARCHY_RANK = 10;

/** Structured Ijazah / Sanad credential for Madrasa faculty. */
export interface FacultyIjazah {
  id: string;
  title: string;
  field: "quran" | "hadith" | "fiqh" | "arabic" | "aqeedah" | "other" | string;
  grantingAuthority: string;
  year?: number | string | null;
  sanadChain?: string | null;
}

/** Madrasa employment contract models: Salaried (Mahanah), Stipend (Wazifa), Hourly, or Volunteer. */
export const FACULTY_CONTRACT_TYPE_VALUES = ["salaried", "wazifa", "hourly", "voluntary"] as const;
export type FacultyContractType = (typeof FACULTY_CONTRACT_TYPE_VALUES)[number];

export const FACULTY_LEAVE_CATEGORY_VALUES = [
  "hajj_umrah",
  "sickness",
  "bereavement",
  "personal",
  "sabbatical",
  "other",
] as const;
export type FacultyLeaveCategory = (typeof FACULTY_LEAVE_CATEGORY_VALUES)[number];

export interface FacultyLeaveDetails {
  isOnLeave: boolean;
  startDate?: string | null;
  endDate?: string | null;
  reason?: string | null;
  category?: FacultyLeaveCategory | string | null;
  substituteFacultyId?: string | null;
  substituteFacultyName?: string | null;
}

/** Hierarchical tree node for organizational chart and task delegation. */
export interface FacultyHierarchyNode {
  id: string;
  contactId: string | number;
  name: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  designationId?: string;
  designationStartsOn?: string;
  designationEndsOn?: string | null;
  designationAssignableRoles?: string[];
  hierarchyRank: number;
  status: string;
  avatar?: string | null;
  reportingFacultyId?: string | null;
  subordinates: FacultyHierarchyNode[];
}

/** Nested employment record (owns contact + employee code). */
export interface FacultyEmploymentFields {
  id?: string;
  contactId?: string | number | null;
  employeeId?: string | null;
  status?: FacultyEmploymentStatus | string;
  employmentStartDate?: string | null;
  employmentEndDate?: string | null;
}

/**
 * Faculty profile linked to an Employment Record + Employ Designation tenure.
 * `employmentId` → employment (required). Flat `contactId` / `status` / employee code /
 * employment dates / `designationId` are API projections / write-through to employment
 * + employ-designation SSOT (not faculty table columns after contract).
 * `status` is employment lifecycle; `employDesignationStatus` is Active|Inactive tenure.
 */
export interface FacultyMember {
  id: string;
  /** API projection / write-through of employment.contact_id. */
  contactId: string | number;
  /** FK to faculty_employments. */
  employmentId?: string | null;
  /** FK to faculty_employ_designations (current tenure). */
  employDesignationId?: string | null;
  /** Employ-designation tenures for this employment (form + write when multiple cards). */
  employDesignations?: FacultyEmployDesignationWriteRow[];
  name?: string;
  /** Employee Code — API projection / write-through of employment.employee_id. */
  employeeId?: string;
  phone?: string;
  email?: string;
  gender?: "male" | "female";
  avatar?: string | null;
  specialization?: string;
  department?: string;
  departmentId?: string;
  designation?: string;
  designationId?: string | null;
  designationStartDate?: string | null;
  designationEndDate?: string | null;
  /** Employ Designation Active|Inactive (tenure SSOT; may mirror profileStatus on write). */
  employDesignationStatus?: FacultyProfileStatus | string;
  parentDesignationId?: string | null;
  employmentStartDate?: string | null;
  employmentEndDate?: string | null;
  employment?: FacultyEmploymentFields | null;
  performanceRating?: number | null;
  designationAssignableRoles?: string[];
  reportingFacultyId?: string | null;
  reportingRole?: string | null;
  reportingRoleId?: string | null;
  reportingDesignationId?: string | null;
  hierarchyRank?: number;
  reportingFacultyName?: string;
  subordinateCount?: number;
  status: string;
  /** Profile Active|Inactive on the faculty row. Prefer employDesignationStatus for tenure. */
  profileStatus?: FacultyProfileStatus | string;
  /** @deprecated Read alias of employmentStartDate from list hydrate. */
  joinDate?: string;
  qualification?: string;
  ijazahs?: FacultyIjazah[];
  employmentContractType?: FacultyContractType | string | null;
  leaveDetails?: FacultyLeaveDetails | null;
  notes?: string;
  userId?: string | null;
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
  restoredAt?: string;
  restoredBy?: string;
  deletedWithCascade?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  [key: string]: unknown;
}

export type Faculty = FacultyMember;

/** Whether a faculty record is soft-deleted. */
export function isFacultyDeleted(facultyMember: { deletedAt?: string | null }): boolean {
  return Boolean(facultyMember.deletedAt);
}

/** Active directory rows — excludes soft-deleted records from Work by default. */
export function filterActiveFaculty<T extends { deletedAt?: string | null }>(
  facultyList: T[],
): T[] {
  return facultyList.filter((facultyMember) => !isFacultyDeleted(facultyMember));
}

/** Default RBAC workspace user role assigned when provisioning a login for faculty. */
export const DEFAULT_FACULTY_USER_ROLE = "staff" as const;
