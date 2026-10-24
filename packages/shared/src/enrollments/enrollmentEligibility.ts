import { SESSION_ENROLLABLE_STATES, normalizeSessionStatus } from "../sessions/sessionLifecycle.js";

/** Why an applicant cannot (yet) be placed in a class. */
export const ELIGIBILITY_REASONS = [
  "dob_missing",
  "age_below",
  "age_above",
  "gender_mismatch",
  "session_not_open",
  "window_closed",
] as const;
export type EligibilityReason = (typeof ELIGIBILITY_REASONS)[number];

export interface EligibilityApplicant {
  /** `YYYY-MM-DD`. */
  dateOfBirth?: string | null;
  gender?: string | null;
}

export interface EligibilityClass {
  gender?: string | null;
  /** 0 = no lower bound. */
  minAge?: number | null;
  /** 0 = no upper bound. */
  maxAge?: number | null;
  /** Age is measured on this day (defaults to the session start date, then `asOf`). */
  ageCalculationDate?: string | null;
  /** Class-level cap (0 = unlimited) when the class has no sections. */
  maxStudents?: number | null;
  enrolled?: number | null;
  sections?: ReadonlyArray<{
    capacity?: number | null;
    enrolled?: number | null;
    status?: string | null;
  }>;
}

export interface EligibilitySession {
  status: string;
  startDate?: string | null;
}

export interface EligibilityInput {
  applicant: EligibilityApplicant;
  cls: EligibilityClass;
  session: EligibilitySession;
  /** Today in the workspace timezone (`YYYY-MM-DD`). */
  asOf: string;
  /** Registration window (ISO instants); outside it the application is rejected. */
  window?: { opensAt?: string | null; closesAt?: string | null; now?: string };
}

export interface EligibilityResult {
  eligible: boolean;
  /** Eligible but no seat left — goes to the waitlist. */
  waitlist: boolean;
  reasons: EligibilityReason[];
  /** Completed years on the age calculation day (null without a date of birth). */
  ageOnDate: number | null;
  /** Remaining seats (null = unlimited). */
  seatsLeft: number | null;
}

/** Completed years between a date of birth and a calendar day (both `YYYY-MM-DD`). */
export function ageOnDate(dateOfBirth: string, onDate: string): number | null {
  const birth = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  const on = /^(\d{4})-(\d{2})-(\d{2})/.exec(onDate);
  if (!birth || !on) return null;
  let years = Number(on[1]) - Number(birth[1]);
  if (Number(on[2]) < Number(birth[2]) || (on[2] === birth[2] && Number(on[3]) < Number(birth[3])))
    years -= 1;
  return years < 0 ? null : years;
}

/** Seats left across active sections, or the class cap; null when unlimited. */
export function remainingSeats(cls: EligibilityClass): number | null {
  const sections = (cls.sections ?? []).filter(
    (section) => (section.status ?? "active") === "active",
  );
  if (sections.length > 0) {
    return sections.reduce(
      (sum, section) => sum + Math.max(0, (section.capacity ?? 0) - (section.enrolled ?? 0)),
      0,
    );
  }
  const cap = cls.maxStudents ?? 0;
  return cap > 0 ? Math.max(0, cap - (cls.enrolled ?? 0)) : null;
}

function genderMatches(
  classGender: string | null | undefined,
  applicantGender: string | null | undefined,
): boolean {
  const required = (classGender ?? "").trim().toLowerCase();
  if (!required || required === "mixed" || required === "any") return true;
  const given = (applicantGender ?? "").trim().toLowerCase();
  const normalized = given === "m" ? "male" : given === "f" ? "female" : given;
  return normalized === required;
}

/**
 * Single eligibility rule for public registration, staff enrollment and promotion:
 * session must accept enrollments, the registration window must be open, the applicant's age on
 * the class's age-calculation day must fall within its bounds, and the gender must match.
 * A full class keeps the applicant eligible but flags `waitlist`.
 */
export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const { applicant, cls, session, asOf, window: openWindow } = input;
  const reasons: EligibilityReason[] = [];
  if (!SESSION_ENROLLABLE_STATES.includes(normalizeSessionStatus(session.status)))
    reasons.push("session_not_open");
  const now = openWindow?.now ?? new Date().toISOString();
  if (
    (openWindow?.opensAt && now < openWindow.opensAt) ||
    (openWindow?.closesAt && now > openWindow.closesAt)
  )
    reasons.push("window_closed");

  const ageDay = cls.ageCalculationDate || session.startDate || asOf;
  const age = applicant.dateOfBirth ? ageOnDate(applicant.dateOfBirth, ageDay) : null;
  const minAge = cls.minAge ?? 0;
  const maxAge = cls.maxAge ?? 0;
  if (minAge > 0 || maxAge > 0) {
    if (age === null) reasons.push("dob_missing");
    else if (minAge > 0 && age < minAge) reasons.push("age_below");
    else if (maxAge > 0 && age > maxAge) reasons.push("age_above");
  }
  if (!genderMatches(cls.gender, applicant.gender)) reasons.push("gender_mismatch");

  const seatsLeft = remainingSeats(cls);
  const eligible = reasons.length === 0;
  return {
    eligible,
    waitlist: eligible && seatsLeft !== null && seatsLeft <= 0,
    reasons,
    ageOnDate: age,
    seatsLeft,
  };
}
