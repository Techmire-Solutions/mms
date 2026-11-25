import {
  applyFacultyScalarCustomFieldDefaults,
  DEFAULT_FACULTY_USER_ROLE,
  resolveFacultyProfileStatus,
  resolveFacultyStatus,
  type FacultyMember,
  type FieldDefinition,
  todayISO,
} from "@mms/contracts";
import { createModuleFormDraft } from "@mms/fe-core/forms/createModuleFormDraft";
import {
  employDesignationRowsFromFaculty,
  employDesignationRowsToWritePayload,
} from "./facultyEmployDesignationFormDraft";

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
  getDefaults: (faculty, defaultSpecialization, todayArg) => {
    const today = typeof todayArg === "string" && todayArg ? todayArg : todayISO();
    return {
      contactId: faculty?.contactId ?? "",
      employeeId: faculty?.employeeId ?? "",
      specialization: faculty?.specialization ?? (defaultSpecialization as string),
      designation: faculty?.designation ?? "",
      designationId: faculty?.designationId ?? "",
      designationStartDate: faculty?.designationStartDate ?? today,
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
        employDesignationRowsFromFaculty(faculty, today),
      ),
      employmentStartDate: faculty?.employmentStartDate ?? faculty?.joinDate ?? today,
      employmentEndDate: faculty?.employmentEndDate ?? null,
      qualification: faculty?.qualification ?? "",
      notes: faculty?.notes ?? "",
      userId: faculty?.userId ?? null,
    };
  },
});

export interface GetInitialFacultyDraftOptions {
  faculty?: FacultyMember;
  defaultSpecialization: string;
  /** Setup fields — seeds enabled custom-field defaults on create. */
  fields?: Record<string, FieldDefinition[]>;
  /** Workspace-local today, used for new effective dates. */
  today?: string;
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
  const fields = isOptions ? (facultyOrOptions as GetInitialFacultyDraftOptions).fields : undefined;
  const today = isOptions ? (facultyOrOptions as GetInitialFacultyDraftOptions).today : undefined;

  const draft = getInitialDraft(faculty, defaultSpecialization, today);
  return fields
    ? (applyFacultyScalarCustomFieldDefaults(
        draft as Record<string, unknown>,
        fields,
      ) as Partial<FacultyMember>)
    : draft;
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

/**
 * Role the linked-account control should show/write.
 *
 * An existing account keeps its own role; the module default (`staff`) only
 * applies when the draft has not been touched and there is no account yet.
 */
export function resolveInitialUserAccountRole(
  draftRole: string | undefined,
  linkedUserRole?: string | null,
): string {
  const draft = draftRole?.trim() ?? "";
  const account = linkedUserRole?.trim() ?? "";
  if (account && (!draft || draft === DEFAULT_FACULTY_USER_ROLE)) return account;
  return draft || account || DEFAULT_FACULTY_USER_ROLE;
}
