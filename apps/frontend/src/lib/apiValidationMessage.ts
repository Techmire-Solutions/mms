import { isApiError } from "@/lib/apiClient";
import type { ValidationError } from "@mms/shared";

function isValidationErrorList(value: unknown): value is ValidationError[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        "fieldId" in item &&
        "message" in item &&
        typeof (item as ValidationError).fieldId === "string" &&
        typeof (item as ValidationError).message === "string",
    )
  );
}

/** Prefer first field-level API validation message (e.g. Contacts unique conflicts). */
export function getApiValidationMessage(error: unknown): string | undefined {
  if (isApiError(error)) {
    if (isValidationErrorList(error.errors) && error.errors[0]?.message) {
      return error.errors[0].message;
    }
    if (error.type === "validation_error" && error.message.trim()) {
      return error.message;
    }
    return undefined;
  }
  if (error && typeof error === "object" && !(error instanceof Error)) {
    const errObj = error as Record<string, unknown>;
    const body = (errObj.body ?? errObj) as Record<string, unknown>;
    if (isValidationErrorList(body.errors) && body.errors[0]?.message) {
      return body.errors[0].message;
    }
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
    if (typeof errObj.message === "string" && errObj.message.trim()) {
      return errObj.message;
    }
  }
  return undefined;
}

export function getApiValidationErrors(error: unknown): ValidationError[] | undefined {
  if (isApiError(error) && isValidationErrorList(error.errors)) {
    return error.errors;
  }
  if (error && typeof error === "object") {
    const errObj = error as Record<string, unknown>;
    const body = (errObj.body ?? errObj) as Record<string, unknown>;
    if (isValidationErrorList(body.errors)) {
      return body.errors;
    }
  }
  return undefined;
}
