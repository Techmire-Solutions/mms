import {
  buildDynamicFacultySchema,
  formatFacultyZodIssues,
  type AppTranslationKey,
  type Contact,
  type FieldDefinition,
  type FacultyDuplicateReason,
  type FacultySettings,
  type ValidationError,
} from "@mms/shared";
import { checkFacultyRegistrationDuplicate } from "@/tenant/features/faculty/hooks/useFaculty";
import { scrollAndFocusFirstError } from "@/lib/forms/formAutoScroll";

/** Focus the first invalid faculty form field with smooth auto-scroll. */
export function focusFacultyValidationField(formInstanceId: string, fieldId: string): void {
  const fieldAliases: Record<string, string[]> = {
    joinDate: ["faculty-employment-start-date", "employmentStartDate"],
    employmentStartDate: ["faculty-employment-start-date", "joinDate"],
    employmentEndDate: ["faculty-employment-end-date"],
    designationStartDate: ["faculty-designation-start-date"],
    designationEndDate: ["faculty-designation-end-date"],
    designation: ["designationId", "designation"],
    designationId: ["designationId", "designation"],
    profileStatus: ["profileStatus"],
    "user.role": ["faculty-user-role", "linked-user-role"],
    "user.password": ["faculty-user-password"],
    "user.email": ["contactId"],
  };

  const aliases = fieldAliases[fieldId] ?? [];
  const candidates = [
    `tf-${formInstanceId}-${fieldId}`,
    fieldId,
    fieldId === "contactId" ? "contactId" : "",
    ...aliases,
  ].filter(Boolean);

  scrollAndFocusFirstError(candidates, { behavior: "smooth", block: "center" });
}

export const DUPLICATE_ERROR_KEYS: Record<FacultyDuplicateReason, AppTranslationKey> = {
  contact: "faculty.form.contactAlreadyFaculty",
  employeeId: "faculty.form.duplicateEmployeeId",
};
export const FACULTY_DUPLICATE_ERROR_KEYS = DUPLICATE_ERROR_KEYS;

export interface FacultyDuplicateCheckInput {
  facultyId?: string;
  contactId: string;
  linkedContact?: Contact | null;
  employeeId?: string;
}

export async function checkFacultyFormDuplicate(
  input: FacultyDuplicateCheckInput,
): Promise<FacultyDuplicateReason | null> {
  return checkFacultyRegistrationDuplicate({
    excludeId: input.facultyId ? String(input.facultyId) : undefined,
    contactId: String(input.contactId),
    employeeId: input.employeeId?.trim() || undefined,
  });
}

export interface FacultyValidationContext {
  settings: FacultySettings;
  enabledTabs: Set<string>;
  fields: Record<string, FieldDefinition[]>;
  language: string;
}

/** Validate a faculty form draft against the dynamic Setup registry schema. */
export function validateFacultyDraft(
  draft: Record<string, unknown>,
  context: FacultyValidationContext,
): ValidationError[] | null {
  const schema = buildDynamicFacultySchema(
    context.settings,
    context.enabledTabs,
    context.fields,
    context.language,
  );
  const result = schema.safeParse(draft);
  const errors: ValidationError[] = result.success
    ? []
    : formatFacultyZodIssues(result.error, draft, context.fields);

  return errors.length > 0 ? errors : null;
}

export function facultyValidationErrorsByField(errors: ValidationError[]): Record<string, string> {
  const byField: Record<string, string> = {};
  for (const error of errors) {
    if (!byField[error.fieldId]) {
      byField[error.fieldId] = error.message;
    }
  }
  return byField;
}
