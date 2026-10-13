import { type Student } from "@/lib/data/studentsData";
import { type Session, type Class } from "@/lib/data/sessionsData";
import { normalizeGenderKey } from "@/lib/ui/genderUi";

export interface CheckResult {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

interface ClassAgeBounds {
  minAge?: number;
  ageMin?: number;
  maxAge?: number;
  ageMax?: number;
}

export function calculateAgeFromDob(dob: string): number {
  const parts = dob.split("-");
  const birthYear = parseInt(parts[0] || "0", 10);
  const birthMonth = parseInt(parts[1] || "1", 10) - 1;
  const birthDay = parseInt(parts[2] || "1", 10);
  if (isNaN(birthYear) || birthYear <= 0) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const m = today.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return Math.max(0, age);
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
    const bounds = sessionClass as ClassAgeBounds;
    const minAge = bounds.minAge ?? bounds.ageMin ?? 0;
    const maxAge = bounds.maxAge ?? bounds.ageMax ?? 100;
    if (age >= minAge && age <= maxAge) {
      if (studentMatchesClassGender(student.gender, sessionClass.gender)) {
        return sessionClass;
      }
    }
  }
  return session.classes[0] || null;
}

export function runFullEligibility(
  student: Partial<Student>,
  session: Session,
  targetClass: Class | null,
  students: Student[],
): CheckResult[] {
  const checks: CheckResult[] = [];

  if (!student.dob) {
    checks.push({
      id: "age",
      label: "Age Eligibility",
      status: "warn",
      detail: "Date of birth not set — cannot verify age.",
    });
  } else {
    const age = calculateAgeFromDob(student.dob);
    const bounds = targetClass as ClassAgeBounds | null;
    const minAge =
      bounds && bounds.minAge != null && bounds.minAge > 0 ? bounds.minAge : (bounds?.ageMin ?? 0);
    const maxAge =
      bounds && bounds.maxAge != null && bounds.maxAge > 0 ? bounds.maxAge : bounds?.ageMax || 25;
    if (age < minAge || age > maxAge) {
      checks.push({
        id: "age",
        label: "Age Eligibility",
        status: "fail",
        detail: `Student is ${age} yrs old. Class requires age ${minAge}–${maxAge}.`,
      });
    } else {
      checks.push({
        id: "age",
        label: "Age Eligibility",
        status: "pass",
        detail: `Age ${age} is within allowed range (${minAge}–${maxAge}).`,
      });
    }
  }

  if (targetClass && !studentMatchesClassGender(student.gender, targetClass.gender)) {
    checks.push({
      id: "gender",
      label: "Gender Match",
      status: "fail",
      detail: `Class is ${targetClass.gender}-only. Student is ${student.gender}.`,
    });
  } else {
    checks.push({
      id: "gender",
      label: "Gender Match",
      status: "pass",
      detail: `Gender matches class requirement.`,
    });
  }

  if (targetClass) {
    const legacyClass = targetClass as Class & { capacity?: number };
    const maxCapacity = targetClass.maxStudents || legacyClass.capacity || 30;
    const enrolled = targetClass.enrolled ?? 0;
    const spotsLeft = maxCapacity - enrolled;
    if (spotsLeft <= 0) {
      checks.push({
        id: "capacity",
        label: "Class Capacity",
        status: "fail",
        detail: `Class is full (${enrolled}/${maxCapacity} students).`,
      });
    } else if (spotsLeft <= 3) {
      checks.push({
        id: "capacity",
        label: "Class Capacity",
        status: "warn",
        detail: `Only ${spotsLeft} spots remaining.`,
      });
    } else {
      checks.push({
        id: "capacity",
        label: "Class Capacity",
        status: "pass",
        detail: `${spotsLeft} of ${maxCapacity} spots available.`,
      });
    }
  } else {
    checks.push({
      id: "capacity",
      label: "Class Capacity",
      status: "fail",
      detail: "No class assigned/available.",
    });
  }

  const isEnrolled = student.enrolledSessions && student.enrolledSessions.includes(session.id);
  if (isEnrolled) {
    checks.push({
      id: "duplicate",
      label: "Duplicate Enrollment",
      status: "fail",
      detail: "Student is already enrolled in this session.",
    });
  } else {
    checks.push({
      id: "duplicate",
      label: "Duplicate Enrollment",
      status: "pass",
      detail: "Student is not already enrolled in this session.",
    });
  }

  const hasSibling = students.some(
    (candidate) =>
      candidate.id !== student.id &&
      (candidate.fatherName === student.fatherName ||
        candidate.motherName === student.motherName) &&
      candidate.status === "active",
  );
  if (hasSibling) {
    checks.push({
      id: "sibling",
      label: "Sibling Connection",
      status: "pass",
      detail: "Active sibling detected. Sibling discount eligible.",
    });
  } else {
    checks.push({
      id: "sibling",
      label: "Sibling Connection",
      status: "warn",
      detail: "No active sibling detected in the system.",
    });
  }

  return checks;
}
