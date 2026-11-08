import {
  evaluateEligibility,
  type EligibilityClass,
  type EligibilityReason,
  type EligibilitySession,
} from "./enrollmentEligibility.js";

/**
 * Enrollment business rules shared by the staff write paths (bulk add, create, approval,
 * withdrawal). Kept pure and exported so the API, the UI and the tests all read the same
 * definitions.
 */

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

const isoDay = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return ISO_DATE_PREFIX.test(trimmed) ? trimmed.slice(0, 10) : null;
};

/**
 * Classes carry an optional `enrollment_deadline` (the "add deadline"). Empty means no
 * deadline; a deadline *day* is inclusive.
 */
export function addDeadlineError(
  deadline: string | null | undefined,
  today: string,
): string | null {
  const day = isoDay(deadline);
  if (!day) return null;
  if (today <= day) return null;
  return `Enrollment for this class closed on ${day}`;
}

/**
 * Classes will carry an optional `drop_deadline` (the "drop deadline"). Empty means no
 * deadline; the deadline *day* is inclusive.
 */
export function dropDeadlineError(
  deadline: string | null | undefined,
  effectiveOn: string,
): string | null {
  const day = isoDay(deadline);
  if (!day) return null;
  if (effectiveOn <= day) return null;
  return `The drop deadline for this class was ${day}`;
}

/**
 * Age/gender eligibility for a staff-initiated write.
 *
 * Staff used to bypass the rule entirely (only public registration and admissions review
 * evaluated it); a wrong-age or wrong-gender student could be enrolled silently. The
 * caller decides whether the reasons block or are overridden (audited).
 */
export function staffEligibilityReasons(input: {
  student: { dob?: string | null; gender?: string | null };
  cls: EligibilityClass;
  session: EligibilitySession;
  asOf: string;
}): EligibilityReason[] {
  const result = evaluateEligibility({
    applicant: { dateOfBirth: input.student.dob ?? null, gender: input.student.gender ?? null },
    cls: input.cls,
    session: input.session,
    asOf: input.asOf,
  });
  // A missing DOB is common in legacy records and must not block a staff add; session
  // state is enforced separately by the caller with the staff (draft-allowed) semantics.
  return result.reasons.filter(
    (reason) => reason !== "dob_missing" && reason !== "session_not_open",
  );
}

export function describeEligibilityReasons(reasons: readonly EligibilityReason[]): string {
  const labels: Record<EligibilityReason, string> = {
    dob_missing: "date of birth is missing",
    age_below: "the student is younger than the class minimum age",
    age_above: "the student is older than the class maximum age",
    gender_mismatch: "the student's gender does not match the class",
    session_not_open: "the session is not open for enrollment",
    window_closed: "the registration window is closed",
  };
  return reasons.map((reason) => labels[reason]).join("; ");
}
