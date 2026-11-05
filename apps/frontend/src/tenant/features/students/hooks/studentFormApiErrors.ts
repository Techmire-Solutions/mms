import type { FieldDefinition, ValidationError } from "@mms/shared";
import { isApiError } from "@/lib/apiError";

/** Shape of the field-level error entries the backend returns in `body.errors`. */
interface ApiFieldError {
  field?: unknown;
  fieldId?: unknown;
  message?: unknown;
}

/** Backend field names that map onto a different form field. */
const FIELD_ALIASES: Record<string, string> = {
  contact: "contactId",
};

/** Fields the form always renders on the registration tab. */
const REGISTRATION_FIELDS = new Set(["grNumber"]);

function firstApiFieldError(error: unknown): ApiFieldError | null {
  if (!isApiError(error) || !Array.isArray(error.errors)) return null;
  const [first] = error.errors;
  return first !== null && typeof first === "object" ? (first as ApiFieldError) : null;
}

/**
 * `true` only for the backend's GR uniqueness conflict: HTTP 409 whose first
 * field error targets `grNumber`. Never infer this from message text.
 */
export function isGrNumberConflict(error: unknown): boolean {
  return (
    isApiError(error) && error.status === 409 && firstApiFieldError(error)?.field === "grNumber"
  );
}

/** Resolves the form tab that owns a field so API errors land on the right tab. */
export function resolveStudentErrorTab(
  fieldId: string,
  fields: Record<string, FieldDefinition[]>,
): string {
  for (const [tabId, tabFields] of Object.entries(fields)) {
    if (tabFields.some((field) => field.key === fieldId)) {
      return tabId === "academic" ? "registration" : tabId;
    }
  }
  return REGISTRATION_FIELDS.has(fieldId) ? "registration" : "basic";
}

/** Maps `ApiError.errors` (`{ field, message }`) onto the student form's `ValidationError[]`. */
export function studentFieldErrorsFromApi(
  error: unknown,
  fields: Record<string, FieldDefinition[]>,
): ValidationError[] {
  if (!isApiError(error) || !Array.isArray(error.errors)) return [];

  const validationErrors: ValidationError[] = [];
  for (const raw of error.errors) {
    if (raw === null || typeof raw !== "object") continue;
    const candidate = raw as ApiFieldError;
    const rawField =
      typeof candidate.field === "string"
        ? candidate.field
        : typeof candidate.fieldId === "string"
          ? candidate.fieldId
          : "";
    const message = typeof candidate.message === "string" ? candidate.message.trim() : "";
    if (!rawField || !message) continue;
    const fieldId = FIELD_ALIASES[rawField] ?? rawField;
    validationErrors.push({
      fieldId,
      tabId: resolveStudentErrorTab(fieldId, fields),
      message,
    });
  }
  return validationErrors;
}
