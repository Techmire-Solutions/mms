import {
  DEFAULT_FACULTY_USER_ROLE,
  resolveFacultyProfileStatus,
  resolveFacultyStatus,
  type FacultyMember,
  todayISO,
} from "@mms/shared";
import { createModuleFormDraft } from "@/lib/forms/createModuleFormDraft";
import {
  employDesignationRowsFromFaculty,
  employDesignationRowsToWritePayload,
} from "@/tenant/features/faculty/components/facultyEmployDesignationFormDraft";

export interface FacultyFormControllerOptions {
  faculty?: FacultyMember;
  onClose: () => void;
  onSave: (faculty: FacultyMember) => void | Promise<void>;
}
export type UseFacultyFormControllerOptions = FacultyFormControllerOptions;

/** Hydrated / archive chrome — not edited on the faculty form. */
const FACULTY_FORM_VOLATILE_KEYS = [
  "id",
  "name",
  "phone",
  "email",
  "gender",
  "avatar",
  "contact",
  "subordinates",
  "subordinateCount",
  "reportingFacultyName",
  "deletedAt",
  "deletedBy",
  "deletionReason",
  "restoredAt",
  "restoredBy",
  "deletedWithCascade",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
];

const { getInitialDraft, draftSnapshot } = createModuleFormDraft<FacultyMember>({
  volatileKeys: FACULTY_FORM_VOLATILE_KEYS,
  getDefaults: (faculty, defaultSpecialization) => ({
    contactId: faculty?.contactId ?? "",
    employeeId: faculty?.employeeId ?? "",
    specialization: faculty?.specialization ?? (defaultSpecialization as string),
    designation: faculty?.designation ?? "",
    designationId: faculty?.designationId ?? "",
    designationStartDate: faculty?.designationStartDate ?? todayISO(),
    designationEndDate: faculty?.designationEndDate ?? null,
    parentDesignationId: faculty?.parentDesignationId ?? null,
    designationAssignableRoles: faculty?.designationAssignableRoles ?? [],
    department: faculty?.department ?? "",
    departmentId: faculty?.departmentId ?? "",
    status: resolveFacultyStatus(faculty?.status),
    profileStatus: resolveFacultyProfileStatus(
      faculty?.employDesignationStatus ?? faculty?.profileStatus,
    ),
    employDesignationStatus: resolveFacultyProfileStatus(
      faculty?.employDesignationStatus ?? faculty?.profileStatus,
    ),
    employDesignationId: faculty?.employDesignationId ?? null,
    employDesignations: employDesignationRowsToWritePayload(
      employDesignationRowsFromFaculty(faculty),
    ),
    employmentStartDate: faculty?.employmentStartDate ?? faculty?.joinDate ?? todayISO(),
    employmentEndDate: faculty?.employmentEndDate ?? null,
    qualification: faculty?.qualification ?? "",
    notes: faculty?.notes ?? "",
    userId: faculty?.userId ?? null,
  }),
});

export interface GetInitialFacultyDraftOptions {
  faculty?: FacultyMember;
  defaultSpecialization: string;
}

/** Draft for FormModal — form-owned fields; strip hydrated chrome. */
export function getInitialFacultyDraft(
  facultyOrOptions?: FacultyMember | GetInitialFacultyDraftOptions,
  defaultSpecializationOrUndefined?: string,
): Partial<FacultyMember> {
  const isOptions =
    facultyOrOptions &&
    typeof facultyOrOptions === "object" &&
    "defaultSpecialization" in facultyOrOptions;
  const faculty = isOptions
    ? (facultyOrOptions as GetInitialFacultyDraftOptions).faculty
    : (facultyOrOptions as FacultyMember | undefined);
  const defaultSpecialization = isOptions
    ? (facultyOrOptions as GetInitialFacultyDraftOptions).defaultSpecialization
    : (defaultSpecializationOrUndefined ?? "");

  return getInitialDraft(faculty, defaultSpecialization);
}

export function facultyDraftSnapshot(draft: Partial<FacultyMember>): string {
  return draftSnapshot(draft);
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null;
}

/** Safely extract a string employee ID from a raw string, response object, or nested wrapper. */
export function extractEmployeeId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (isRecord(value)) {
    if (typeof value.employeeId === "string") {
      return value.employeeId.trim();
    }
    if (isRecord(value.body)) {
      return extractEmployeeId(value.body);
    }
    if (isRecord(value.data)) {
      return extractEmployeeId(value.data);
    }
  }
  return "";
}

export const DEFAULT_USER_ACCOUNT_DRAFT = {
  enabled: false,
  role: DEFAULT_FACULTY_USER_ROLE,
  setupMethod: "password" as const,
  password: "",
  forceReset: true,
};
