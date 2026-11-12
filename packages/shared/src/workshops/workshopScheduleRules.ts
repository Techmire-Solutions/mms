import { countWorkshopDays, WORKSHOP_MAX_DAYS } from "./workshopDays.js";

/**
 * Calendar rules shared by the Zod contract and the write transaction (extracted from
 * `workshopLifecycle.ts` for the 300-line band). Keeping one evaluator means the form, the API and
 * the transaction cannot disagree about date order, the deadline window or the maximum span.
 */

// ─── Date rules (shared by the Zod contract and the write transaction) ────────────────────────

export const WORKSHOP_DATE_VIOLATIONS = [
  "end_before_start",
  "deadline_after_end",
  "span_too_long",
] as const;
export type WorkshopDateViolation = (typeof WORKSHOP_DATE_VIOLATIONS)[number];

export interface WorkshopDateInput {
  startDate?: string | null;
  endDate?: string | null;
  registrationDeadline?: string | null;
}

/** End on or after start; the deadline cannot fall after the last workshop day. */
export function evaluateWorkshopDateRules(value: WorkshopDateInput): WorkshopDateViolation[] {
  const violations: WorkshopDateViolation[] = [];
  const start = (value.startDate ?? "").slice(0, 10);
  const end = (value.endDate ?? "").slice(0, 10);
  if (start && end && end < start) violations.push("end_before_start");
  const lastDay = end || start;
  const deadline = (value.registrationDeadline ?? "").slice(0, 10);
  if (deadline && lastDay && deadline > lastDay) violations.push("deadline_after_end");
  // A run longer than WORKSHOP_MAX_DAYS is modelled as a session, not a workshop; it also used to
  // silently truncate the completion denominator while the numerator stayed uncapped.
  if (countWorkshopDays(start || null, end || null) > WORKSHOP_MAX_DAYS) {
    violations.push("span_too_long");
  }
  return violations;
}
