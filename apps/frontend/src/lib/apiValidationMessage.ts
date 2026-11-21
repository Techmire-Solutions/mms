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

interface RawZodIssue {
  code?: string;
  message?: string;
  path?: Array<string | number>;
}

/**
 * Parses raw JSON-stringified Zod error strings into structured ValidationError objects.
 * Handles paths like ["phones", 0, "number"], ["emails", 1, "address"], ["firstName"], etc.
 */
function tryParseZodJsonErrors(raw: string): ValidationError[] | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const errors: ValidationError[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const issue = item as RawZodIssue;
      const message = typeof issue.message === "string" ? issue.message.trim() : "";
      if (!message) continue;
      const path = Array.isArray(issue.path) ? issue.path : [];

      if (path.length >= 3 && typeof path[0] === "string" && typeof path[1] === "number") {
        errors.push({
          tabId: path[0],
          index: path[1],
          fieldId: String(path[2] ?? path[0]),
          message,
        });
      } else if (path.length === 2 && typeof path[0] === "string" && typeof path[1] === "number") {
        errors.push({
          tabId: path[0],
          index: path[1],
          fieldId: path[0],
          message,
        });
      } else if (path.length >= 1 && typeof path[0] === "string") {
        errors.push({
          tabId:
            path[0] === "firstName" || path[0] === "lastName" || path[0] === "cnic"
              ? "basic"
              : path[0],
          fieldId: path[path.length - 1] ? String(path[path.length - 1]) : path[0],
          message,
        });
      } else {
        errors.push({
          tabId: "basic",
          fieldId: "base",
          message,
        });
      }
    }
    return errors.length > 0 ? errors : null;
  } catch {
    return null;
  }
}

/** Prefer first field-level API validation message (e.g. Contacts unique conflicts). */
export function getApiValidationMessage(error: unknown): string | undefined {
  if (isApiError(error)) {
    if (isValidationErrorList(error.errors) && error.errors[0]?.message) {
      return error.errors[0].message;
    }
    if (error.type === "validation_error" && error.message.trim()) {
      const parsedZod = tryParseZodJsonErrors(error.message);
      if (parsedZod && parsedZod[0]?.message) {
        return parsedZod[0].message;
      }
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
      const parsedZod = tryParseZodJsonErrors(body.message);
      if (parsedZod && parsedZod[0]?.message) {
        return parsedZod[0].message;
      }
      return body.message;
    }
    if (typeof errObj.message === "string" && errObj.message.trim()) {
      const parsedZod = tryParseZodJsonErrors(errObj.message);
      if (parsedZod && parsedZod[0]?.message) {
        return parsedZod[0].message;
      }
      return errObj.message;
    }
  }
  return undefined;
}

export function getApiValidationErrors(error: unknown): ValidationError[] | undefined {
  if (isApiError(error)) {
    if (isValidationErrorList(error.errors)) {
      return error.errors;
    }
    if (error.type === "validation_error" && typeof error.message === "string") {
      const parsedZod = tryParseZodJsonErrors(error.message);
      if (parsedZod) return parsedZod;
    }
  }
  if (error && typeof error === "object") {
    const errObj = error as Record<string, unknown>;
    const body = (errObj.body ?? errObj) as Record<string, unknown>;
    if (isValidationErrorList(body.errors)) {
      return body.errors;
    }
    const msg =
      typeof body.message === "string"
        ? body.message
        : typeof errObj.message === "string"
          ? errObj.message
          : null;
    if (msg) {
      const parsedZod = tryParseZodJsonErrors(msg);
      if (parsedZod) return parsedZod;
    }
  }
  return undefined;
}
