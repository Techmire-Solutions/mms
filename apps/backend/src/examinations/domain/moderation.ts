import { MAX_GRACE_MARKS } from "@mms/shared";
import { ValidationError } from "../../lib/httpErrors.js";

/**
 * Audited grace-mark moderation rules.
 *
 * Moderation is a scoring decision, so its validation lives in the domain layer rather than in the
 * Drizzle repository that happens to persist it. The raw `marks_obtained` is never rewritten; the
 * adjustment and its attribution live beside it, and the effective score is what the pass/grade
 * engine and the DB bounds trigger evaluate.
 *
 * `assertEffectiveWithinTotal` is called inside the write transaction (it compares against the
 * exam total read under the same lock); the input guards are pure.
 */

/** Trims and validates the audit reason required for a moderation. */
export function normalizeModerationReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new ValidationError("A moderation reason is required");
  }
  return trimmed;
}

/**
 * Grace must be a finite, non-negative number within the `grace_marks numeric(6,2)` range.
 *
 * The column holds at most 9999.99; validating against the marks column's 999999.99 ceiling used to
 * let a large grace reach Postgres as `22003 numeric overflow` (a 500).
 */
export function assertGraceWithinRange(graceMarks: number): void {
  if (!Number.isFinite(graceMarks) || graceMarks < 0) {
    throw new ValidationError("Grace marks must be a non-negative number");
  }
  if (graceMarks > MAX_GRACE_MARKS) {
    throw new ValidationError(`Grace marks cannot exceed ${MAX_GRACE_MARKS}`);
  }
}

/** `marks_obtained + grace_marks` — the score the student actually earned after moderation. */
export function effectiveMarks(marksObtained: number, graceMarks: number): number {
  const marks = Number(marksObtained);
  return (Number.isFinite(marks) ? marks : 0) + graceMarks;
}

/** A moderated result may not exceed the exam's total marks (the DB trigger is the backstop). */
export function assertEffectiveWithinTotal(effective: number, totalMarks: number): void {
  if (effective > totalMarks) {
    throw new ValidationError(
      `Marks plus grace (${effective}) cannot exceed the exam total (${totalMarks})`,
    );
  }
}
