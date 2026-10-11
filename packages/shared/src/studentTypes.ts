import type { SerializedEntityAuditFields } from "./softDelete.js";

/** Active enrollment status for a student profile. */
export const STUDENT_STATUS_VALUES = [
  "active",
  "inactive",
  "suspended",
  "graduated",
  "transferred",
] as const;
export type StudentStatus = (typeof STUDENT_STATUS_VALUES)[number];

/** Prefer configured status options; fall back to the shared default list. */
export function resolveStudentStatuses(statuses?: readonly string[] | null): readonly string[] {
  return statuses && statuses.length > 0 ? statuses : STUDENT_STATUS_VALUES;
}

/**
 * Student profile in the `students` collection.
 * Identity fields are hydrated from linked contacts — not persisted when contact ids are set.
 */
export interface Student extends SerializedEntityAuditFields {
  id: string;
  contactId: string | number;
  /** Hydrated from student Contact. */
  name?: string;
  gender?: "male" | "female";
  dob?: string;
  phone?: string;
  email?: string;
  city?: string;
  fatherContactId?: string | number | null;
  motherContactId?: string | number | null;
  /** Other guardian (uncle, sibling, etc.) when not father/mother. */
  guardianContactId?: string | number | null;
  /** Hydrated from father Contact. */
  fatherName?: string;
  /** Hydrated from mother Contact. */
  motherName?: string;
  /** Hydrated from guardian Contact. */
  guardianName?: string;
  cnic?: string;
  grNumber?: string;
  studentId?: string;
  status?: StudentStatus;
  registeredDate?: string;
  enrollmentDate?: string;
  enrolledSessions?: string[];
  discountType?: string;
  discountPct?: number;
  registrationType?: string;
  notes?: string;
  [key: string]: unknown;
}

/** Whether a student record is soft-deleted. */
export function isStudentDeleted(student: { deletedAt?: string | null }): boolean {
  return Boolean(student.deletedAt);
}

/** Active directory rows — excludes soft-deleted records from Work by default. */
export function filterActiveStudents<T extends { deletedAt?: string | null }>(students: T[]): T[] {
  return students.filter((student) => !isStudentDeleted(student));
}
