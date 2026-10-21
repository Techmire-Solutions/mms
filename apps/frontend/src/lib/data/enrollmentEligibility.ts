import { ageOnDate, evaluateEligibility, remainingSeats, type EligibilityClass } from "@mms/shared";
import { type Student } from "@/lib/data/studentsData";
import { type Session, type Class } from "@/lib/data/sessionsData";
import { normalizeGenderKey } from "@/lib/ui/genderUi";

/**
 * Presentation adapter over the shared eligibility rule (`@mms/shared` `evaluateEligibility`).
 *
 * The age, gender and seat rules live in `@mms/shared` so public registration, staff enrollment
 * and promotion all decide the same way. This module only turns that verdict into the wizard
 * check rows, and adds the two checks the shared rule has no inputs for: duplicate enrollment
 * and sibling detection.
 */
export interface CheckResult {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

/** Legacy class rows carry `ageMin` / `ageMax` / `capacity` aliases alongside the current names. */
interface LegacyClassBounds {
  minAge?: number;
  ageMin?: number;
  maxAge?: number;
  ageMax?: number;
  capacity?: number;
}

/** Today as `YYYY-MM-DD` in the viewer timezone. */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Resolved age bounds, keeping the historic wizard defaults (no lower bound, ceiling 25). */
function ageBounds(bounds: LegacyClassBounds | null): { minAge: number; maxAge: number } {
  const minAge =
    bounds && bounds.minAge != null && bounds.minAge > 0 ? bounds.minAge : (bounds?.ageMin ?? 0);
  const maxAge =
    bounds && bounds.maxAge != null && bounds.maxAge > 0 ? bounds.maxAge : bounds?.ageMax || 25;
  return { minAge, maxAge };
}

/** Adapts a UI class row to the shared eligibility contract. */
function toEligibilityClass(targetClass: Class | null): EligibilityClass {
  const legacy = targetClass as (Class & LegacyClassBounds) | null;
  const { minAge, maxAge } = ageBounds(legacy);
  return {
    gender: targetClass?.gender ?? null,
    minAge,
    maxAge,
    maxStudents: targetClass?.maxStudents || legacy?.capacity || 30,
    enrolled: targetClass?.enrolled ?? 0,
    ageCalculationDate: todayIso(),
  };
}

export function calculateAgeFromDob(dob: string): number {
  return Math.max(0, ageOnDate(dob, todayIso()) ?? 0);
}

export function studentMatchesClassGender(
  studentGender: string | null | undefined,
  classGender: string,
): boolean {
  const requirement = classGender.trim().toLowerCase();
  return (
    requirement === "any" ||
    requirement === "mixed" ||
    normalizeGenderKey(studentGender) === requirement
  );
}

export function suggestClass(student: Partial<Student>, session: Session): Class | null {
  if (!student.dob) return null;
  const age = calculateAgeFromDob(student.dob);
  for (const sessionClass of session.classes) {
    const { minAge, maxAge } = ageBounds(sessionClass as LegacyClassBounds);
    if (age >= minAge && age <= maxAge) {
      if (studentMatchesClassGender(student.gender, sessionClass.gender)) {
        return sessionClass;
      }
    }
  }
  return session.classes[0] || null;
}

/** Age row, derived from the age the shared rule measured. */
function ageCheck(
  student: Partial<Student>,
  targetClass: Class | null,
  age: number | null,
): CheckResult {
  if (!student.dob) {
    return {
      id: "age",
      label: "Age Eligibility",
      status: "warn",
      detail: "Date of birth not set — cannot verify age.",
    };
  }
  const { minAge, maxAge } = ageBounds(targetClass as LegacyClassBounds | null);
  const resolved = age ?? calculateAgeFromDob(student.dob);
  return resolved < minAge || resolved > maxAge
    ? {
        id: "age",
        label: "Age Eligibility",
        status: "fail",
        detail: `Student is ${resolved} yrs old. Class requires age ${minAge}–${maxAge}.`,
      }
    : {
        id: "age",
        label: "Age Eligibility",
        status: "pass",
        detail: `Age ${resolved} is within allowed range (${minAge}–${maxAge}).`,
      };
}

/** Seat row, derived from the shared seat calculation. */
function capacityCheck(targetClass: Class | null, seatsLeft: number | null): CheckResult {
  if (!targetClass) {
    return {
      id: "capacity",
      label: "Class Capacity",
      status: "fail",
      detail: "No class assigned/available.",
    };
  }
  const legacy = targetClass as Class & LegacyClassBounds;
  const maxCapacity = targetClass.maxStudents || legacy.capacity || 30;
  const spotsLeft = seatsLeft ?? maxCapacity - (targetClass.enrolled ?? 0);
  if (spotsLeft <= 0) {
    return {
      id: "capacity",
      label: "Class Capacity",
      status: "fail",
      detail: `Class is full (${targetClass.enrolled ?? 0}/${maxCapacity} students).`,
    };
  }
  return spotsLeft <= 3
    ? {
        id: "capacity",
        label: "Class Capacity",
        status: "warn",
        detail: `Only ${spotsLeft} spots remaining.`,
      }
    : {
        id: "capacity",
        label: "Class Capacity",
        status: "pass",
        detail: `${spotsLeft} of ${maxCapacity} spots available.`,
      };
}

export function runFullEligibility(
  student: Partial<Student>,
  session: Session,
  targetClass: Class | null,
  students: Student[],
): CheckResult[] {
  const cls = toEligibilityClass(targetClass);
  const verdict = evaluateEligibility({
    applicant: { dateOfBirth: student.dob ?? null, gender: student.gender ?? null },
    cls,
    // The wizard checks placement only; session state and the registration window are
    // enforced server-side, so the rule is asked with an enrollable state.
    session: { status: "open", startDate: null },
    asOf: todayIso(),
  });

  const genderMismatch = verdict.reasons.includes("gender_mismatch");
  const checks: CheckResult[] = [
    ageCheck(student, targetClass, verdict.ageOnDate),
    targetClass && genderMismatch
      ? {
          id: "gender",
          label: "Gender Match",
          status: "fail",
          detail: `Class is ${targetClass.gender}-only. Student is ${student.gender}.`,
        }
      : {
          id: "gender",
          label: "Gender Match",
          status: "pass",
          detail: `Gender matches class requirement.`,
        },
    capacityCheck(targetClass, targetClass ? remainingSeats(cls) : null),
  ];

  const isEnrolled = student.enrolledSessions && student.enrolledSessions.includes(session.id);
  checks.push(
    isEnrolled
      ? {
          id: "duplicate",
          label: "Duplicate Enrollment",
          status: "fail",
          detail: "Student is already enrolled in this session.",
        }
      : {
          id: "duplicate",
          label: "Duplicate Enrollment",
          status: "pass",
          detail: "Student is not already enrolled in this session.",
        },
  );

  const hasSibling = students.some(
    (candidate) =>
      candidate.id !== student.id &&
      (candidate.fatherName === student.fatherName ||
        candidate.motherName === student.motherName) &&
      candidate.status === "active",
  );
  checks.push(
    hasSibling
      ? {
          id: "sibling",
          label: "Sibling Connection",
          status: "pass",
          detail: "Active sibling detected. Sibling discount eligible.",
        }
      : {
          id: "sibling",
          label: "Sibling Connection",
          status: "warn",
          detail: "No active sibling detected in the system.",
        },
  );

  return checks;
}
