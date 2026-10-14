import type { z } from "zod";
import type { ValidationError } from "@mms/shared";

export type { ValidationError };

export interface ValidationErrorOptions {
  /** Maps a top-level field id to its owning form tab. */
  resolveTabId?: (fieldId: string) => string | undefined;
  /** Tab used when no resolver matches (defaults to `"basic"`). */
  fallbackTabId?: string;
  /** Resolves a Zod message (often an {@link AppTranslationKey}) to display copy. */
  resolveMessage?: (message: string) => string;
}

/**
 * Single mapper from a Zod error to the shared `ValidationError[]` contract
 * (`{ fieldId, tabId, message, index? }`).
 *
 * Hand-rolled forms call it directly; `createZodFormResolver` reuses it so RHF
 * forms emit the identical shape. Module forms with bespoke tab routing
 * (`formatZodIssues`, `formatStudentZodIssues`) stay the authority for their own
 * shape and may pass `resolveTabId` to align with this one.
 */
export function toValidationErrors(
  error: z.ZodError,
  options: ValidationErrorOptions = {},
): ValidationError[] {
  const { resolveTabId, fallbackTabId = "basic", resolveMessage } = options;

  return error.issues.map((issue) => {
    const [pathRoot, pathIndex, pathField] = issue.path;
    const index = typeof pathIndex === "number" ? pathIndex : undefined;
    const fieldId =
      typeof pathRoot === "string"
        ? String(index !== undefined ? (pathField ?? pathRoot) : pathRoot)
        : String(pathRoot ?? "");
    const message = resolveMessage ? resolveMessage(issue.message) : issue.message;
    const tabId = resolveTabId?.(String(pathRoot ?? "")) ?? fallbackTabId;

    return index !== undefined ? { fieldId, tabId, message, index } : { fieldId, tabId, message };
  });
}

/**
 * First non-empty validation message — the shared source for the `FormModal`
 * top-of-modal `error` banner used by both hand-rolled and RHF forms.
 */
export function firstValidationErrorMessage(
  errors: readonly ValidationError[] | undefined,
  resolveMessage: (message: string) => string,
): string {
  const first = errors?.find((error) => error.message);
  return first ? resolveMessage(first.message) : "";
}
