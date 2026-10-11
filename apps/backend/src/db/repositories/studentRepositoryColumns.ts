import { sql } from "drizzle-orm";
import { students } from "../schema.js";

/**
 * Canonical column projection for `students` SELECT queries.
 *
 * All hydration functions (findStudentById, findStudentsByIds, listStudentsByWorkspace,
 * listStudentsPage, listActiveStudentsMissingGrNumber, findSoftDeletedStudentByContactIdSql)
 * must use this constant instead of repeating the 20-column literal inline.
 *
 * Deviation: listStudentsPage omits `notes` for bandwidth; it passes
 * `sql<string | null>`NULL`.as('notes')` as an override — that is the only
 * permitted per-query override and must be documented at the call-site.
 */
export const STUDENT_COLUMNS = {
  id: students.id,
  workspaceSubdomain: students.workspaceSubdomain,
  contactId: students.contactId,
  fatherContactId: students.fatherContactId,
  motherContactId: students.motherContactId,
  guardianContactId: students.guardianContactId,
  fatherName: students.fatherName,
  motherName: students.motherName,
  guardianName: students.guardianName,
  grNumber: students.grNumber,
  studentId: students.studentId,
  status: students.status,
  registeredDate: students.registeredDate,
  enrollmentDate: students.enrollmentDate,
  discountType: students.discountType,
  discountPct: students.discountPct,
  registrationType: students.registrationType,
  notes: students.notes,
  customFields: students.customFields,
  deletedAt: students.deletedAt,
  deletedBy: students.deletedBy,
  deletionReason: students.deletionReason,
  restoredAt: students.restoredAt,
  restoredBy: students.restoredBy,
  deletedWithCascade: students.deletedWithCascade,
  createdAt: students.createdAt,
  updatedAt: students.updatedAt,
  createdBy: students.createdBy,
  updatedBy: students.updatedBy,
} as const;

/**
 * Bandwidth-optimised projection for list-page queries.
 * Omits `notes` (large text, not needed in Work directory rows).
 * Consumers must NOT render or filter on notes from list results.
 */
export const STUDENT_COLUMNS_LIST = {
  ...STUDENT_COLUMNS,
  notes: sql<string | null>`NULL`.as("notes"),
} as const;
