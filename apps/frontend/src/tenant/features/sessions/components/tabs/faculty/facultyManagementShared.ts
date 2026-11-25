import type { AppTranslationKey } from "@mms/contracts";
import type { Session } from "@/lib/data/sessionsData";

/**
 * Common session-faculty roles. `value` is the stable stored identifier; `labelKey` is the
 * localized display label. Keep `value` in sync with any already-persisted role strings.
 */
export const COMMON_FACULTY_ROLES: ReadonlyArray<{
  value: string;
  labelKey: AppTranslationKey;
}> = [
  { value: "Head Instructor", labelKey: "sessions.faculty.roles.headInstructor" },
  { value: "Lead Instructor", labelKey: "sessions.faculty.roles.leadInstructor" },
  { value: "Assistant Instructor", labelKey: "sessions.faculty.roles.assistantInstructor" },
  { value: "Department Head", labelKey: "sessions.faculty.roles.departmentHead" },
  { value: "Academic Coordinator", labelKey: "sessions.faculty.roles.academicCoordinator" },
  { value: "Tajweed Supervisor", labelKey: "sessions.faculty.roles.tajweedSupervisor" },
  { value: "Examiner", labelKey: "sessions.faculty.roles.examiner" },
  { value: "Administrator", labelKey: "sessions.faculty.roles.administrator" },
];

/** Localized label for a stored faculty role; custom/unknown roles are returned verbatim. */
export function facultyRoleLabel(
  role: string | undefined,
  t: (key: AppTranslationKey) => string,
): string {
  if (!role) return "";
  const known = COMMON_FACULTY_ROLES.find((entry) => entry.value === role);
  return known ? t(known.labelKey) : role;
}

export interface FacultyManagementTabProps {
  session: Session;
  onUpdate: (updatedSession: Session) => void | Promise<void>;
  /** Writable flag (detail passes both names; `canMutate` wins for older callers). */
  canWrite?: boolean;
  canMutate?: boolean;
}
