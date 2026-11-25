/**
 * Machine-readable enrollment API error codes (`ApiError.type`).
 *
 * Kept in the shared package so the backend throws a constant and the frontend can branch
 * on a union instead of matching message text or re-typing string literals.
 */
export const ENROLLMENT_ERROR_CODES = [
  "class_full",
  "already_enrolled",
  "roll_no_taken",
  "add_deadline_passed",
  "drop_deadline_passed",
  "invalid_status_transition",
  "not_operable",
  "invalid_payment_status",
] as const;

export type EnrollmentErrorCode = (typeof ENROLLMENT_ERROR_CODES)[number];

/** Whether an `ApiError.type` is a known enrollment-domain code. */
export function isEnrollmentErrorCode(value: unknown): value is EnrollmentErrorCode {
  return typeof value === "string" && (ENROLLMENT_ERROR_CODES as readonly string[]).includes(value);
}
