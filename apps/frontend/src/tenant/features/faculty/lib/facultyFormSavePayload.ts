import {
  type FacultyMember,
  type FieldDefinition,
  getPrimaryEmail,
  listEnabledCustomFacultyFormFields,
  normalizeStoredFaculty,
} from "@mms/contracts";
import { notify } from "@/lib/notify";
import { getApiValidationMessage } from "@/lib/apiValidationMessage";
import { extractEmployeeId } from "@/tenant/features/faculty/lib/facultyFormDraft";
import type { FacultySaveFlowInput } from "@/tenant/features/faculty/lib/facultyFormSaveFlow";
import { sanitizeFacultyIjazahs } from "@/tenant/features/faculty/lib/facultyIjazahPayload";

export interface FacultySavePayloadInput {
  facultyDraft?: Partial<FacultyMember>;
  faculty?: FacultyMember;
  autoGenerateId: boolean;
  nextEmployeeId?: string;
  /**
   * Setup Fields map. Enabled custom fields live in `faculty.custom_data` on the
   * wire and are keyed by `field.key`, so they must be copied explicitly.
   */
  fields?: Record<string, readonly FieldDefinition[]>;
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
  // Not a typed column: the server persists unknown wire keys in `faculty.custom_data`.
  // Enabled Setup custom fields are merged below from the field registry.
  "employmentContractType",
  "ijazahs",
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

  // Custom Setup Fields are not part of the static allowlist. They are validated
  // by the dynamic schema and persisted into `faculty.custom_data`, so dropping
  // them here silently discarded every custom value the user had entered.
  const customValues: Record<string, unknown> = {};
  const draftRecord = draft as Record<string, unknown>;
  for (const field of listEnabledCustomFacultyFormFields(input.fields ?? {})) {
    const value = draftRecord[field.key];
    if (value !== undefined) customValues[field.key] = value;
  }

  const payload: Record<string, unknown> = {
    ...customValues,
    ...base,
    ...(draft.ijazahs ? { ijazahs: sanitizeFacultyIjazahs(draft.ijazahs) } : {}),
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
