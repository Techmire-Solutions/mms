/**
 * Machine-readable enrollment audit reason codes stored in `newState.reasonCode`.
 * Server-derived only — exposed here so reports/filters can type against the same union.
 */
export const ENROLLMENT_AUDIT_REASON_CODES = [
  "create",
  "status_change",
  "fee_adjustment",
  "payment_status",
  "details_edit",
  "withdraw",
  "transfer",
  "readmit",
  "suspend",
  "override_deadline",
  "override_eligibility",
  "trash",
  "restore",
  "session_completed",
  "session_cancelled",
  "student_status",
  "rollover",
  "bulk_enroll",
  "waitlist_offer",
  "waitlist_offer_expired",
  "waitlist_offer_revoked",
] as const;

export type EnrollmentAuditReasonCode = (typeof ENROLLMENT_AUDIT_REASON_CODES)[number];
