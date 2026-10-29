/**
 * @file sessionTypes.ts
 * @description Domain types and strict Zod schemas for Academic Sessions Management (Model 6).
 */
import { z } from "zod";
import { SessionClassSectionSchema } from "./sessionSectionTypes.js";
import { WEEKDAY_NAMES } from "../attendance/academicCalendar.js";
import { isoDateOrEmptySchema } from "../core/isoDateSchema.js";
import {
  SessionClassBudgetInsertSchema,
  SessionClassBudgetSchema,
  SessionClassDiscountInsertSchema,
  SessionClassDiscountSchema,
  SessionClassFeeInsertSchema,
  SessionClassFeeSchema,
  SessionClassRefreshmentInsertSchema,
  SessionClassRefreshmentSchema,
  SessionClassScheduleInsertSchema,
  SessionClassScheduleSchema,
  SessionClassScholarshipInsertSchema,
  SessionClassScholarshipSchema,
  SessionClassTimetableInsertSchema,
  SessionClassTimetableSchema,
  SessionFacultyInsertSchema,
  SessionFacultySchema,
} from "./sessionSubEntityTypes.js";

// Re-export all sub-entity schemas and types for complete backward compatibility
export {
  SessionFacultySchema,
  SessionFacultyInsertSchema,
  type SessionFaculty,
  type SessionFacultyInsert,
  SessionClassFeeSchema,
  SessionClassFeeInsertSchema,
  type SessionClassFee,
  type SessionClassFeeInsert,
  SessionClassScheduleSchema,
  SessionClassScheduleInsertSchema,
  type SessionClassSchedule,
  type SessionClassScheduleInsert,
  SessionClassBudgetSchema,
  SessionClassBudgetInsertSchema,
  type SessionClassBudget,
  type SessionClassBudgetInsert,
  SessionClassDiscountSchema,
  SessionClassDiscountInsertSchema,
  type SessionClassDiscount,
  type SessionClassDiscountInsert,
  SessionClassTimetablePeriodSchema,
  SessionClassTimetablePeriodInsertSchema,
  type SessionClassTimetablePeriod,
  type SessionClassTimetablePeriodInsert,
  SessionClassTimetableSchema,
  SessionClassTimetableInsertSchema,
  type SessionClassTimetable,
  type SessionClassTimetableInsert,
  SessionClassRefreshmentSchema,
  SessionClassRefreshmentInsertSchema,
  type SessionClassRefreshment,
  type SessionClassRefreshmentInsert,
  ScholarshipEligibilitySchema,
  ScholarshipEligibilityInsertSchema,
  type ScholarshipEligibility,
  type ScholarshipEligibilityInsert,
  SessionClassScholarshipSchema,
  SessionClassScholarshipInsertSchema,
  type SessionClassScholarship,
  type SessionClassScholarshipInsert,
} from "./sessionSubEntityTypes.js";

// ============================================================================
// 9. Session Class (Core Container)
// ============================================================================
export const ClassSchema = z
  .object({
    id: z.string(),
    sessionId: z.string().optional(),
    name: z.string().min(1, "Class name is required"),
    gender: z.enum(["male", "female", "mixed"]).default("mixed"),
    ageCalculationDate: z.string().optional().default(""),
    minAge: z.coerce.number().int().min(0).max(120).default(0),
    maxAge: z.coerce.number().int().min(0).max(120).default(0),
    maxStudents: z.coerce.number().int().min(0).default(0), // Maximum Student Count / Capacity
    enrolled: z.coerce.number().int().nonnegative().default(0),
    enrollmentDeadline: z.string().optional().default(""),
    status: z.enum(["active", "inactive"]).default("active"),
    facultyId: z.string().optional().default(""),
    facultyName: z.string().optional().default(""),
    room: z.string().optional().default(""),
    /** `programs.id` (defaults to the session's program). */
    programId: z.string().optional(),
    /** Sections of the class (omit to leave stored sections untouched). */
    sections: z.array(SessionClassSectionSchema).optional(),
    // Model 6 Child sub-entities
    fees: z.array(SessionClassFeeSchema).default([]),
    schedules: z.array(SessionClassScheduleSchema).default([]),
    budgets: z.array(SessionClassBudgetSchema).default([]),
    discounts: z.array(SessionClassDiscountSchema).default([]),
    timetables: z.array(SessionClassTimetableSchema).default([]),
    refreshments: z.array(SessionClassRefreshmentSchema).default([]),
    scholarships: z.array(SessionClassScholarshipSchema).default([]),
  })
  .strict();

export const ClassInsertSchema = z
  .object({
    id: z.string().optional(),
    sessionId: z.string().optional(),
    name: z.string().min(1, "Class name is required"),
    gender: z.enum(["male", "female", "mixed"]).default("mixed"),
    ageCalculationDate: z.string().optional().default(""),
    minAge: z.coerce.number().int().min(0).max(120).default(0),
    maxAge: z.coerce.number().int().min(0).max(120).default(0),
    maxStudents: z.coerce.number().int().min(0).default(0),
    enrolled: z.coerce.number().int().nonnegative().default(0),
    enrollmentDeadline: z.string().optional().default(""),
    status: z.enum(["active", "inactive"]).default("active"),
    facultyId: z.string().optional().default(""),
    facultyName: z.string().optional().default(""),
    room: z.string().optional().default(""),
    programId: z.string().optional(),
    sections: z.array(SessionClassSectionSchema).optional(),
    fees: z.array(SessionClassFeeInsertSchema).default([]),
    schedules: z.array(SessionClassScheduleInsertSchema).default([]),
    budgets: z.array(SessionClassBudgetInsertSchema).default([]),
    discounts: z.array(SessionClassDiscountInsertSchema).default([]),
    timetables: z.array(SessionClassTimetableInsertSchema).default([]),
    refreshments: z.array(SessionClassRefreshmentInsertSchema).default([]),
    scholarships: z.array(SessionClassScholarshipInsertSchema).default([]),
  })
  .strict();

export type Class = z.infer<typeof ClassSchema>;
export type ClassInsert = z.infer<typeof ClassInsertSchema>;

// ============================================================================
// 10. Session (Root Entity)
// ============================================================================
export const SessionSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1, "Session name is required"),
    // Lifecycle state (see sessionLifecycle); legacy values are normalized server-side.
    status: z.string().trim().min(1).max(50).default("draft"),
    /** Legacy display snapshot; superseded by `categoryId` / `programId`. */
    type: z.string().optional().default("academic"),
    /** `session_categories.id` (Academic Year, Term, Short Course, …). */
    categoryId: z.string().optional(),
    /** `programs.id` — default program for the session's classes. */
    programId: z.string().optional(),
    startDate: isoDateOrEmptySchema.optional().default(""),
    endDate: isoDateOrEmptySchema.optional().default(""),
    /** Weekly teaching days for this session; empty/absent = the workspace attendance working days. */
    workingDays: z.array(z.enum(WEEKDAY_NAMES)).max(7).optional(),
    /** Short-course completion: minimum attendance % (null = not required). */
    minAttendancePct: z.coerce.number().int().min(0).max(100).nullable().optional(),
    /** Short-course completion: every class exam must be passed. */
    requiresExamPass: z.boolean().optional(),
    description: z.string().optional(),
    currency: z.string().optional().default("PKR"),
    baseFee: z.coerce.number().nonnegative().default(0),
    // Model 6 components
    faculty: z.array(SessionFacultySchema).default([]),
    classes: z.array(ClassSchema).default([]),
    // Soft-delete metadata
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
    restoredAt: z.string().nullable().optional(),
    restoredBy: z.string().nullable().optional(),
    deletedWithCascade: z.boolean().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const SessionInsertSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, "Session name is required"),
    // Lifecycle state (see sessionLifecycle); legacy values are normalized server-side.
    status: z.string().trim().min(1).max(50).default("draft"),
    /** Legacy display snapshot; superseded by `categoryId` / `programId`. */
    type: z.string().optional().default("academic"),
    /** `session_categories.id` (Academic Year, Term, Short Course, …). */
    categoryId: z.string().optional(),
    /** `programs.id` — default program for the session's classes. */
    programId: z.string().optional(),
    startDate: isoDateOrEmptySchema.optional().default(""),
    endDate: isoDateOrEmptySchema.optional().default(""),
    description: z.string().optional(),
    currency: z.string().optional().default("PKR"),
    baseFee: z.coerce.number().nonnegative().default(0),
    faculty: z.array(SessionFacultyInsertSchema).default([]),
    classes: z.array(ClassInsertSchema).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export type Session = z.infer<typeof SessionSchema>;
export type SessionInsert = z.infer<typeof SessionInsertSchema>;
export const SessionUpdateSchema = SessionInsertSchema.partial();
export type SessionUpdate = z.infer<typeof SessionUpdateSchema>;

/** Canonical record schema standard */
export const sessionRecordSchema = SessionSchema;
export const sessionListSchema = z.array(sessionRecordSchema);
export type SessionRecord = Session;

/** Whether a session record is soft-deleted. */
export function isSessionDeleted(session: { deletedAt?: string | null }): boolean {
  return Boolean(session.deletedAt);
}

/** Active directory rows — excludes soft-deleted records from Work by default. */
export function filterActiveSessions<T extends { deletedAt?: string | null }>(sessions: T[]): T[] {
  return sessions.filter((session) => !isSessionDeleted(session));
}
