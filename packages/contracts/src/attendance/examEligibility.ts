/**
 * Exam eligibility gating.
 *
 * A student may sit an exam only when their attendance percentage for the session window meets the
 * exam's minimum. The percentage is the **same** figure completion uses (present-or-late over
 * countable days, one decimal place) — the previous integer-rounded report value disagreed with the
 * completion gate at the threshold, so 74.5 % was "75" in one place and "below 75" in another.
 */

import { z } from "zod";

/** Every eligibility decision the gate can return (shared by the engine, DTO and contract). */
export const EXAM_ELIGIBILITY_STATES = ["eligible", "blocked", "unknown"] as const;

export type ExamEligibilityState = (typeof EXAM_ELIGIBILITY_STATES)[number];

export const examEligibilityStateSchema = z.enum(EXAM_ELIGIBILITY_STATES);

export interface ExamEligibilityInput {
  /** Present-or-late share of countable days, one decimal. `null` when nothing is countable yet. */
  attendancePct: number | null;
  /** `null`/`0` disables the gate for this exam. */
  minPct: number | null | undefined;
  /** An audited override granted for this (exam, student). */
  overridden?: boolean;
}

export interface ExamEligibilityResult {
  state: ExamEligibilityState;
  /** The percentage the decision used (already rounded to one decimal), when known. */
  attendancePct: number | null;
  requiredPct: number | null;
  /** True when an override is what makes this eligible. */
  overridden: boolean;
}

/** One-decimal percentage, matching how completion stores and compares attendance. */
export function attendancePctFromCounts(present: number, countable: number): number | null {
  if (!Number.isFinite(countable) || countable <= 0) return null;
  const presentSafe = Math.max(0, Math.min(present, countable));
  return Math.round((presentSafe / countable) * 1000) / 10;
}

/**
 * Eligibility decision.
 *
 * `attendancePct === null` (no countable day yet) is **unknown**, not eligible: a student cannot be
 * cleared to sit on the strength of an absent data set. Callers must either wait for marks or grant
 * a recorded override.
 */
export function evaluateExamEligibility(input: ExamEligibilityInput): ExamEligibilityResult {
  const required = typeof input.minPct === "number" && input.minPct > 0 ? input.minPct : null;
  const pct = input.attendancePct;
  const overridden = input.overridden === true;

  if (required === null) {
    return { state: "eligible", attendancePct: pct, requiredPct: null, overridden: false };
  }
  if (overridden) {
    return { state: "eligible", attendancePct: pct, requiredPct: required, overridden: true };
  }
  if (pct === null) {
    return { state: "unknown", attendancePct: null, requiredPct: required, overridden: false };
  }
  return {
    state: pct >= required ? "eligible" : "blocked",
    attendancePct: pct,
    requiredPct: required,
    overridden: false,
  };
}

/** True when results may be entered for this student. */
export function isExamEligible(result: ExamEligibilityResult): boolean {
  return result.state === "eligible";
}
