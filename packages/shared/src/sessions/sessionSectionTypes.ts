import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

/** Section lifecycle: closed sections keep history but accept no new enrollments. */
export const SECTION_STATUSES = ["active", "closed"] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];

/** Section (A, B…) of a session class — roster, room and capacity. */
export const SessionClassSectionSchema = z
  .object({
    id: z.string().min(1),
    classId: z.string().optional(),
    name: z.string().trim().min(1, "Section name is required").max(50),
    capacity: z.coerce.number().int().min(0).default(30),
    room: z.string().max(100).optional().default(""),
    status: z.enum(SECTION_STATUSES).default("active"),
    /** Read-only: current class teacher resolved from staff assignments. */
    classTeacherId: z.string().optional(),
    classTeacherName: z.string().optional(),
    /** Read-only: active, non-cancelled enrollments. */
    enrolled: z.coerce.number().int().nonnegative().optional(),
  })
  .strict();
export type SessionClassSection = z.infer<typeof SessionClassSectionSchema>;

export const SECTION_STAFF_ROLES = ["class_teacher", "subject_teacher", "assistant"] as const;
export type SectionStaffRole = (typeof SECTION_STAFF_ROLES)[number];

/** Roles with at most one holder at a time per section (per subject for subject teachers). */
export const SINGLE_HOLDER_SECTION_ROLES: readonly SectionStaffRole[] = [
  "class_teacher",
  "subject_teacher",
];

export const SectionStaffAssignmentSchema = z
  .object({
    id: z.string(),
    sectionId: z.string(),
    facultyId: z.string(),
    facultyName: z.string(),
    role: z.enum(SECTION_STAFF_ROLES),
    subjectId: z.string().nullable(),
    subjectName: z.string().nullable(),
    startOn: z.string(),
    endOn: z.string().nullable(),
    changeReason: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();
export type SectionStaffAssignment = z.infer<typeof SectionStaffAssignmentSchema>;

/** Assign (or change) a section teacher from an effective date. */
export const sectionStaffAssignBodySchema = z
  .object({
    facultyId: z.string().min(1),
    role: z.enum(SECTION_STAFF_ROLES),
    subjectId: z.string().min(1).nullish(),
    startOn: isoDateSchema,
    reason: z.string().trim().max(500).nullish(),
  })
  .strict();
export type SectionStaffAssignBody = z.infer<typeof sectionStaffAssignBodySchema>;

/** End an assignment (or a student role) on a date. */
export const sectionAssignmentEndBodySchema = z
  .object({
    endOn: isoDateSchema,
    reason: z.string().trim().max(500).nullish(),
  })
  .strict();
export type SectionAssignmentEndBody = z.infer<typeof sectionAssignmentEndBodySchema>;

export const SECTION_STUDENT_ROLES = ["monitor", "assistant"] as const;
export type SectionStudentRoleKind = (typeof SECTION_STUDENT_ROLES)[number];

export const SectionStudentRoleSchema = z
  .object({
    id: z.string(),
    sectionId: z.string(),
    enrollmentId: z.string(),
    studentName: z.string(),
    role: z.enum(SECTION_STUDENT_ROLES),
    startOn: z.string(),
    endOn: z.string().nullable(),
  })
  .strict();
export type SectionStudentRole = z.infer<typeof SectionStudentRoleSchema>;

export const sectionStudentRoleBodySchema = z
  .object({
    enrollmentId: z.string().min(1),
    role: z.enum(SECTION_STUDENT_ROLES),
    startOn: isoDateSchema,
  })
  .strict();
export type SectionStudentRoleBody = z.infer<typeof sectionStudentRoleBodySchema>;

/** Previous calendar day for an ISO date (closing an assignment the day before its successor starts). */
export function dayBeforeIsoDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Whether an effective-dated row covers `onDate` (inclusive bounds; open-ended when endOn is null). */
export function isAssignmentActiveOn(
  row: { startOn: string; endOn: string | null },
  onDate: string,
): boolean {
  return row.startOn <= onDate && (row.endOn === null || row.endOn >= onDate);
}
