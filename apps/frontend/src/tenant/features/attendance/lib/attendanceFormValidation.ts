import type { z } from "zod";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";

/**
 * Attendance form validation.
 *
 * Every attendance form validates its draft against the **same shared schema the API enforces**
 * before it mutates, and maps both Zod issues and server rejections onto field ids so the user sees
 * which input failed instead of a generic toast (or nothing at all). Zod issues use the shared
 * `mapZodFormErrors`; server payloads are read here so the adapter has no untracked dependency.
 */

export interface AttendanceFormValidation<T> {
  ok: boolean;
  data?: T;
  fieldErrors: Record<string, string>;
  message: string;
}

export function validateAttendanceDraft<T>(
  schema: z.ZodType<T>,
  draft: unknown,
  resolveMessage: (message: string) => string,
): AttendanceFormValidation<T> {
  const result = schema.safeParse(draft);
  if (result.success) return { ok: true, data: result.data, fieldErrors: {}, message: "" };
  const fieldErrors = mapZodFormErrors(result.error, resolveMessage);
  const message = fieldErrors[String(result.error.issues[0]?.path[0] ?? "")] ?? "";
  return { ok: false, fieldErrors, message };
}

/**
 * Field-level message from a server rejection.
 *
 * A batch envelope (`details.errors[]`) is flattened onto its row ids where present; otherwise the
 * domain message is returned so the form banner can show it.
 */
export function serverFormError(
  error: unknown,
  resolveMessage: (message: string) => string = (message) => message,
): { fieldErrors: Record<string, string>; message: string } {
  const candidate = (error ?? {}) as {
    message?: unknown;
    fieldErrors?: Record<string, unknown>;
    details?: { errors?: Array<{ studentId?: unknown; message?: unknown }> };
    errors?: Array<{ studentId?: unknown; message?: unknown }> | Record<string, unknown>;
  };
  const fieldErrors: Record<string, string> = {};
  if (candidate.fieldErrors && typeof candidate.fieldErrors === "object") {
    for (const [key, value] of Object.entries(candidate.fieldErrors)) {
      if (typeof value === "string") fieldErrors[key] = value;
    }
  }
  const rows = candidate.details?.errors ?? candidate.errors;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const key = row?.studentId ? String(row.studentId) : "_form";
      if (row?.message && !fieldErrors[key]) {
        fieldErrors[key] = resolveMessage(String(row.message));
      }
    }
  }
  const message =
    (typeof candidate.message === "string" ? candidate.message.trim() : "") ||
    fieldErrors._form ||
    Object.values(fieldErrors)[0] ||
    "";
  return { fieldErrors, message };
}
