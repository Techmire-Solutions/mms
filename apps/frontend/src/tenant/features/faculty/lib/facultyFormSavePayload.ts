import { type FacultyMember, getPrimaryEmail, normalizeStoredFaculty } from "@mms/shared";
import { notify } from "@/lib/notify";
import { getApiValidationMessage } from "@/lib/apiValidationMessage";
import { extractEmployeeId } from "@/tenant/features/faculty/components/facultyFormDraft";
import type { FacultySaveFlowInput } from "@/tenant/features/faculty/components/facultyFormSaveFlow";

export interface FacultySavePayloadInput {
  facultyDraft?: Partial<FacultyMember>;
  faculty?: FacultyMember;
  autoGenerateId: boolean;
  nextEmployeeId?: string;
}

/** Persisted faculty row keys (Faculty Management model) — never the read projections. */
const FACULTY_PERSIST_KEYS = [
  "contactId",
  "employmentId",
  "employDesignationId",
  "employDesignations",
  "employeeId",
  "status",
  "profileStatus",
  "employDesignationStatus",
  "specialization",
  "qualification",
  "designationId",
  "designationStartDate",
  "designationEndDate",
  "employmentStartDate",
  "employmentEndDate",
  "notes",
] as const;

function pickDraftKeys(
  draft: Partial<FacultyMember>,
  keys: readonly string[],
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in draft && draft[key as keyof FacultyMember] !== undefined) {
      picked[key] = draft[key as keyof FacultyMember];
    }
  }
  return picked;
}

/** Build the save payload (resolved employeeId + typed contactId) from the draft. */
export function buildFacultySavePayload(input: FacultySavePayloadInput): Partial<FacultyMember> {
  const draft = input.facultyDraft ?? {};
  const entity = input.faculty;
  const rawEmployeeId = extractEmployeeId(draft.employeeId);
  const rawNextEmployeeId = extractEmployeeId(input.nextEmployeeId);
  const resolvedEmployeeId =
    rawEmployeeId || (input.autoGenerateId && !entity?.id ? rawNextEmployeeId : undefined);

  const base = pickDraftKeys(draft, FACULTY_PERSIST_KEYS);

  const payload: Record<string, unknown> = {
    ...base,
    employeeId: resolvedEmployeeId,
    contactId: String(draft.contactId || ""),
    designationId: draft.designationId ? String(draft.designationId) : null,
    designationStartDate: draft.designationStartDate
      ? String(draft.designationStartDate)
      : undefined,
    designationEndDate: draft.designationEndDate ? String(draft.designationEndDate) : null,
    employmentEndDate: draft.employmentEndDate ? String(draft.employmentEndDate) : null,
    ...(entity?.id != null ? { id: entity.id } : {}),
  };

  return normalizeStoredFaculty(payload) as Partial<FacultyMember>;
}

/** Validates email, role, and password requirements when user account creation is requested. */
export function validateUserDraftRequirements(input: FacultySaveFlowInput): boolean {
  if (!input.userAccountDraft?.enabled || input.linkedUser) return true;

  const primaryEmail = input.linkedContact ? getPrimaryEmail(input.linkedContact) : null;
  if (!primaryEmail) {
    const warning = input.t("faculty.form.noEmailWarning");
    input.setErrors({ "user.email": warning });
    notify.error(warning);
    return false;
  }
  if (!input.userAccountDraft.role) {
    input.setErrors({ "user.role": input.t("users.errorRoleRequired") });
    notify.error(input.t("users.errorRoleRequired"));
    return false;
  }
  if (input.userAccountDraft.setupMethod === "password") {
    const pwd = input.userAccountDraft.password?.trim() || "";
    if (!pwd || pwd.length < 8) {
      const errKey = !pwd ? "users.addErrorPassword" : "auth.passwordCheckLength";
      input.setErrors({ "user.password": input.t(errKey) });
      notify.error(input.t(errKey));
      return false;
    }
  }
  return true;
}

/** Detects if a save error is an employee ID uniqueness conflict. */
export function isEmployeeIdConflictError(err: unknown): boolean {
  const validationMessage = getApiValidationMessage(err);
  const errText = String(err instanceof Error ? err.message : err || "").toLowerCase();
  return (
    errText.includes("employeeid") ||
    errText.includes("employee_id") ||
    errText.includes("duplicate_employee") ||
    (typeof validationMessage === "string" && validationMessage.toLowerCase().includes("employee"))
  );
}

export { type FacultySaveFlowInput };
