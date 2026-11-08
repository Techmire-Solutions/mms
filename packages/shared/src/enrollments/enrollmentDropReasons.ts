/** Structured drop/withdrawal reasons; the free-text detail stays in `reason`. */
export const ENROLLMENT_DROP_REASON_CODES = [
  "financial",
  "relocation",
  "academic",
  "medical",
  "discipline",
  "schedule",
  "other",
] as const;

export type EnrollmentDropReason = (typeof ENROLLMENT_DROP_REASON_CODES)[number];
