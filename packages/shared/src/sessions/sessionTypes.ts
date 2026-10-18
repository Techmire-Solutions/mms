/**
 * @file sessionTypes.ts
 * @description Domain types and strict Zod schemas for Academic Sessions Management (Model 6).
 */
import { z } from "zod";
import { SessionClassSectionSchema } from "./sessionSectionTypes.js";
import { WEEKDAY_NAMES } from "../attendance/academicCalendar.js";

// ============================================================================
// 1. Session Management (Faculty Assigned to Session)
// ============================================================================
export const SessionFacultySchema = z
  .object({
    id: z.string(),
    sessionId: z.string(),
    facultyId: z.string(),
    facultyName: z.string().optional().default(""),
    role: z.string().min(1, "Role is required"), // dynamic roles: e.g., 'coordinator', 'supervisor', 'head'
    status: z.enum(["active", "inactive"]).default("active"),
    createdAt: z.string().optional(),
  })
  .strict();

export const SessionFacultyInsertSchema = z
  .object({
    id: z.string().optional(),
    sessionId: z.string().optional(),
    facultyId: z.string().min(1, "Faculty is required"),
    facultyName: z.string().optional().default(""),
    role: z.string().min(1, "Role is required"),
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .strict();

export type SessionFaculty = z.infer<typeof SessionFacultySchema>;
export type SessionFacultyInsert = z.infer<typeof SessionFacultyInsertSchema>;

// ============================================================================
// 2. Session Class Fee
// ============================================================================
export const SessionClassFeeSchema = z
  .object({
    id: z.string(),
    classId: z.string().optional(),
    feeType: z.string().min(1, "Fee type is required"), // dynamic: admission, monthly, one_time, exam, material
    amount: z.coerce.number().nonnegative("Amount must be non-negative").default(0),
  })
  .strict();

export const SessionClassFeeInsertSchema = z
  .object({
    id: z.string().optional(),
    classId: z.string().optional(),
    feeType: z.string().min(1, "Fee type is required"),
    amount: z.coerce.number().nonnegative("Amount must be non-negative").default(0),
  })
  .strict();

export type SessionClassFee = z.infer<typeof SessionClassFeeSchema>;
export type SessionClassFeeInsert = z.infer<typeof SessionClassFeeInsertSchema>;

// ============================================================================
// 3. Session Class Schedule
// ============================================================================
export const SessionClassScheduleSchema = z
  .object({
    id: z.string(),
    classId: z.string().optional(),
    scheduleType: z.string().min(1, "Schedule type is required"), // dynamic: daily, weekly, monthly, weekend
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .strict();

export const SessionClassScheduleInsertSchema = z
  .object({
    id: z.string().optional(),
    classId: z.string().optional(),
    scheduleType: z.string().min(1, "Schedule type is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .strict();

export type SessionClassSchedule = z.infer<typeof SessionClassScheduleSchema>;
export type SessionClassScheduleInsert = z.infer<typeof SessionClassScheduleInsertSchema>;

// ============================================================================
// 4. Session Class Budget
// ============================================================================
export const SessionClassBudgetSchema = z
  .object({
    id: z.string(),
    classId: z.string().optional(),
    budgetType: z.enum(["income", "expense"]),
    detail: z.string().min(1, "Budget detail is required"),
    amount: z.coerce.number().nonnegative("Amount must be non-negative").default(0),
  })
  .strict();

export const SessionClassBudgetInsertSchema = z
  .object({
    id: z.string().optional(),
    classId: z.string().optional(),
    budgetType: z.enum(["income", "expense"]),
    detail: z.string().min(1, "Budget detail is required"),
    amount: z.coerce.number().nonnegative("Amount must be non-negative").default(0),
  })
  .strict();

export type SessionClassBudget = z.infer<typeof SessionClassBudgetSchema>;
export type SessionClassBudgetInsert = z.infer<typeof SessionClassBudgetInsertSchema>;

// ============================================================================
// 5. Session Class Discounts
// ============================================================================
export const SessionClassDiscountSchema = z
  .object({
    id: z.string(),
    classId: z.string().optional(),
    discountType: z.string().min(1, "Discount type is required"), // sibling, date_based, academic_achievement, etc.
    percentage: z.coerce.number().min(0).max(100, "Percentage must be 0-100").default(0),
    startDate: z.string().optional().default(""),
    endDate: z.string().optional().default(""),
    eligibilityCriteria: z.record(z.string(), z.unknown()).optional().default({}),
    status: z.enum(["active", "expired", "inactive"]).default("active"),
  })
  .strict();

export const SessionClassDiscountInsertSchema = z
  .object({
    id: z.string().optional(),
    classId: z.string().optional(),
    discountType: z.string().min(1, "Discount type is required"),
    percentage: z.coerce.number().min(0).max(100, "Percentage must be 0-100").default(0),
    startDate: z.string().optional().default(""),
    endDate: z.string().optional().default(""),
    eligibilityCriteria: z.record(z.string(), z.unknown()).optional().default({}),
    status: z.enum(["active", "expired", "inactive"]).default("active"),
  })
  .strict();

export type SessionClassDiscount = z.infer<typeof SessionClassDiscountSchema>;
export type SessionClassDiscountInsert = z.infer<typeof SessionClassDiscountInsertSchema>;

// ============================================================================
// 6. Session Class Timetable & Periods
// ============================================================================
export const SessionClassTimetablePeriodSchema = z
  .object({
    id: z.string(),
    timetableId: z.string().optional(),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    subject: z.string().min(1, "Subject is required"),
    /** `subjects.id`; the server refreshes `subject` from the catalog when set. */
    subjectId: z.string().optional(),
    facultyId: z.string().optional().default(""),
    /** Extra teachers on this period (assistants / co-teachers). */
    assistantFacultyIds: z.array(z.string().min(1)).max(10).optional(),
    facultyName: z.string().optional().default(""),
  })
  .strict();

export const SessionClassTimetablePeriodInsertSchema = z
  .object({
    id: z.string().optional(),
    timetableId: z.string().optional(),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    subject: z.string().min(1, "Subject is required"),
    /** `subjects.id`; the server refreshes `subject` from the catalog when set. */
    subjectId: z.string().optional(),
    facultyId: z.string().optional().default(""),
    /** Extra teachers on this period (assistants / co-teachers). */
    assistantFacultyIds: z.array(z.string().min(1)).max(10).optional(),
    facultyName: z.string().optional().default(""),
  })
  .strict();

export type SessionClassTimetablePeriod = z.infer<typeof SessionClassTimetablePeriodSchema>;
export type SessionClassTimetablePeriodInsert = z.infer<
  typeof SessionClassTimetablePeriodInsertSchema
>;

export const SessionClassTimetableSchema = z
  .object({
    id: z.string(),
    classId: z.string().optional(),
    date: z.string().min(1, "Timetable date or day is required"), // filtered from schedule
    periods: z.array(SessionClassTimetablePeriodSchema).default([]),
  })
  .strict();

export const SessionClassTimetableInsertSchema = z
  .object({
    id: z.string().optional(),
    classId: z.string().optional(),
    date: z.string().min(1, "Timetable date or day is required"),
    periods: z.array(SessionClassTimetablePeriodInsertSchema).default([]),
  })
  .strict();

export type SessionClassTimetable = z.infer<typeof SessionClassTimetableSchema>;
export type SessionClassTimetableInsert = z.infer<typeof SessionClassTimetableInsertSchema>;

// ============================================================================
// 7. Session Class Refreshment
// ============================================================================
export const SessionClassRefreshmentSchema = z
  .object({
    id: z.string(),
    classId: z.string().optional(),
    date: z.string().min(1, "Date is required"),
    item: z.string().min(1, "Item name is required"),
    quantity: z.coerce.number().int().nonnegative("Quantity must be non-negative").default(0),
    pricePerUnit: z.coerce.number().nonnegative("Unit price must be non-negative").default(0),
    paidAmount: z.coerce.number().nonnegative("Paid amount must be non-negative").default(0),
  })
  .strict();

export const SessionClassRefreshmentInsertSchema = z
  .object({
    id: z.string().optional(),
    classId: z.string().optional(),
    date: z.string().min(1, "Date is required"),
    item: z.string().min(1, "Item name is required"),
    quantity: z.coerce.number().int().nonnegative("Quantity must be non-negative").default(0),
    pricePerUnit: z.coerce.number().nonnegative("Unit price must be non-negative").default(0),
    paidAmount: z.coerce.number().nonnegative("Paid amount must be non-negative").default(0),
  })
  .strict();

export type SessionClassRefreshment = z.infer<typeof SessionClassRefreshmentSchema>;
export type SessionClassRefreshmentInsert = z.infer<typeof SessionClassRefreshmentInsertSchema>;

// ============================================================================
// 8. Scholarship Eligibility & Session Class Scholarship
// ============================================================================
export const ScholarshipEligibilitySchema = z
  .object({
    id: z.string(),
    orphan: z.boolean().default(false),
    job: z.boolean().default(false),
    business: z.boolean().default(false),
    property: z.boolean().default(false),
    familyMembers: z.coerce.number().int().nonnegative().default(0),
    onJobMembers: z.coerce.number().int().nonnegative().default(0),
    schoolGoingSiblings: z.coerce.number().int().nonnegative().default(0),
    residence: z.string().default("rental"), // dynamic: rental, property/owned, etc.
    notes: z.string().optional(),
  })
  .strict();

export const ScholarshipEligibilityInsertSchema = z
  .object({
    id: z.string().optional(),
    orphan: z.boolean().default(false),
    job: z.boolean().default(false),
    business: z.boolean().default(false),
    property: z.boolean().default(false),
    familyMembers: z.coerce.number().int().nonnegative().default(0),
    onJobMembers: z.coerce.number().int().nonnegative().default(0),
    schoolGoingSiblings: z.coerce.number().int().nonnegative().default(0),
    residence: z.string().default("rental"),
    notes: z.string().optional(),
  })
  .strict();

export type ScholarshipEligibility = z.infer<typeof ScholarshipEligibilitySchema>;
export type ScholarshipEligibilityInsert = z.infer<typeof ScholarshipEligibilityInsertSchema>;

export const SessionClassScholarshipSchema = z
  .object({
    id: z.string(),
    classId: z.string().optional(),
    scholarshipEligibilityId: z.string().optional(),
    eligibility: ScholarshipEligibilitySchema.optional(),
    percentage: z.coerce.number().min(0).max(100, "Percentage must be 0-100").default(0),
    expiryDate: z.string().optional().default(""),
  })
  .strict();

export const SessionClassScholarshipInsertSchema = z
  .object({
    id: z.string().optional(),
    classId: z.string().optional(),
    scholarshipEligibilityId: z.string().optional(),
    eligibility: ScholarshipEligibilityInsertSchema.optional(),
    percentage: z.coerce.number().min(0).max(100, "Percentage must be 0-100").default(0),
    expiryDate: z.string().optional().default(""),
  })
  .strict();

export type SessionClassScholarship = z.infer<typeof SessionClassScholarshipSchema>;
export type SessionClassScholarshipInsert = z.infer<typeof SessionClassScholarshipInsertSchema>;

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
    startDate: z.string().optional().default(""),
    endDate: z.string().optional().default(""),
    /** Weekly teaching days for this session; empty/absent = the workspace attendance working days. */
    workingDays: z.array(z.enum(WEEKDAY_NAMES)).max(7).optional(),
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
    startDate: z.string().optional().default(""),
    endDate: z.string().optional().default(""),
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
