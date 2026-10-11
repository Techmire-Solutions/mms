/** Employment lifecycle status (DB CHECK + Zod enum SSOT). */
export const FACULTY_EMPLOYMENT_STATUS_VALUES = [
  "active",
  "on_leave",
  "inactive",
  "retired",
  "terminated",
] as const;
export type FacultyEmploymentStatus = (typeof FACULTY_EMPLOYMENT_STATUS_VALUES)[number];

/**
 * @deprecated Prefer {@link FACULTY_EMPLOYMENT_STATUS_VALUES}. Kept as alias for
 * Work metrics / bulk-status that still key off employment lifecycle.
 */
export const FACULTY_STATUS_VALUES = FACULTY_EMPLOYMENT_STATUS_VALUES;
export type FacultyStatus = FacultyEmploymentStatus;

/** Faculty profile Active|Inactive (separate from employment lifecycle). */
export const FACULTY_PROFILE_STATUS_VALUES = ["active", "inactive"] as const;
export type FacultyProfileStatus = (typeof FACULTY_PROFILE_STATUS_VALUES)[number];

/** Catalog lifecycle status shared by departments and designations. */
export const FACULTY_CATALOG_STATUS_VALUES = ["active", "inactive"] as const;
export type FacultyCatalogStatus = (typeof FACULTY_CATALOG_STATUS_VALUES)[number];

/** True when `value` is a member of {@link FACULTY_EMPLOYMENT_STATUS_VALUES}. */
export function isFacultyStatus(value: unknown): value is FacultyEmploymentStatus {
  return (
    typeof value === "string" &&
    (FACULTY_EMPLOYMENT_STATUS_VALUES as readonly string[]).includes(value)
  );
}

/** True when `value` is a member of {@link FACULTY_PROFILE_STATUS_VALUES}. */
export function isFacultyProfileStatus(value: unknown): value is FacultyProfileStatus {
  return (
    typeof value === "string" &&
    (FACULTY_PROFILE_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export type FacultyStatusRoles = {
  active: string;
  onLeave: string;
  inactive: string;
  retired: string;
  terminated: string;
};

/** Named roles for employment status values (SSOT for status-driven UI and metrics). */
export function resolveFacultyStatusRoles(): FacultyStatusRoles {
  const [active, onLeave, inactive, retired, terminated] = FACULTY_EMPLOYMENT_STATUS_VALUES;
  return { active, onLeave, inactive, retired, terminated };
}

/** Statuses that count as an ended employment (no longer on staff). */
export const FACULTY_ENDED_STATUSES: readonly FacultyEmploymentStatus[] = ["retired", "terminated"];

/** Default employment status when unset. */
export const DEFAULT_FACULTY_STATUS: FacultyEmploymentStatus = FACULTY_EMPLOYMENT_STATUS_VALUES[0];

/** Default profile status when unset. */
export const DEFAULT_FACULTY_PROFILE_STATUS: FacultyProfileStatus =
  FACULTY_PROFILE_STATUS_VALUES[0];

/** Prefer configured status options; fall back to the employment status list. */
export function resolveFacultyStatuses(statuses?: readonly string[] | null): readonly string[] {
  return statuses && statuses.length > 0 ? statuses : FACULTY_EMPLOYMENT_STATUS_VALUES;
}

/** Resolve the effective employment status, falling back to {@link DEFAULT_FACULTY_STATUS}. */
export function resolveFacultyStatus(status?: string | null): string {
  return status || DEFAULT_FACULTY_STATUS;
}

/** Resolve profile Active|Inactive, falling back to {@link DEFAULT_FACULTY_PROFILE_STATUS}. */
export function resolveFacultyProfileStatus(status?: string | null): FacultyProfileStatus {
  return isFacultyProfileStatus(status) ? status : DEFAULT_FACULTY_PROFILE_STATUS;
}
