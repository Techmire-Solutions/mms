import type { Permission } from "../auth/permissions.js";
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

export const ENROLLMENT_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "withdrawn",
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** Statuses that no longer occupy a seat (class `enrolled`, capacity, session membership). */
export const SEAT_RELEASED_ENROLLMENT_STATUSES = [
  "cancelled",
  "withdrawn",
] as const satisfies readonly EnrollmentStatus[];

/** Whether an enrollment with this status still holds a seat in its class. */
export function enrollmentHoldsSeat(status: string): boolean {
  return !(SEAT_RELEASED_ENROLLMENT_STATUSES as readonly string[]).includes(status);
}

export const ENROLLMENT_PAYMENT_STATUSES = ["paid", "pending", "none"] as const;
export type EnrollmentPaymentStatus = (typeof ENROLLMENT_PAYMENT_STATUSES)[number];

export const enrollmentTimelineItemSchema = z
  .object({
    id: z.number().optional(),
    ts: z.string(),
    event: z.string(),
    by: z.string(),
    /** Server-written typed event (transfer, withdrawal…); absent on free-text entries. */
    eventType: z.string().nullable().optional(),
    effectiveOn: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    fromClassId: z.string().nullable().optional(),
    toClassId: z.string().nullable().optional(),
    fromSectionId: z.string().nullable().optional(),
    toSectionId: z.string().nullable().optional(),
  })
  .strict();

export type EnrollmentTimelineItem = z.infer<typeof enrollmentTimelineItemSchema>;

export const enrollmentRecordSchema = z
  .object({
    id: z.string(),
    studentId: z.string(),
    studentName: z.string().optional().default(""),
    sessionId: z.string(),
    sessionName: z.string().optional().default(""),
    classId: z.string(),
    className: z.string().optional().default(""),
    /** `session_class_sections.id`; defaults to the class's first section on write. */
    sectionId: z.string().optional(),
    /** Roll number within the section. */
    rollNo: z.string().max(64).optional(),
    enrolledDate: z.string(),
    /** Enrollment window: late join (start) and withdrawal (end). Null start = `enrolledDate`. */
    startOn: z.string().nullable().optional(),
    endOn: z.string().nullable().optional(),
    endReason: z.string().nullable().optional(),
    baseFee: z.number().default(0),
    discountType: z.string().optional().default("none"),
    discountLabel: z.string().optional().default(""),
    discountPct: z.number().default(0),
    discountAmt: z.number().default(0),
    finalFee: z.number().default(0),
    status: z.enum(ENROLLMENT_STATUSES).default("pending"),
    invoiceId: z.string().nullable().optional(),
    paymentStatus: z.enum(ENROLLMENT_PAYMENT_STATUSES).default("none"),
    notes: z.string().optional().default(""),
    timeline: z.array(enrollmentTimelineItemSchema).optional().default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
    restoredAt: z.string().nullable().optional(),
    restoredBy: z.string().nullable().optional(),
    deletedWithCascade: z.boolean().nullable().optional(),
  })
  .strict();

export const enrollmentRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    studentId: z.string().min(1, "Student is required"),
    studentName: z.string().optional().default(""),
    sessionId: z.string().min(1, "Session is required"),
    sessionName: z.string().optional().default(""),
    classId: z.string().min(1, "Class is required"),
    className: z.string().optional().default(""),
    /** `session_class_sections.id`; defaults to the class's first section on write. */
    sectionId: z.string().optional(),
    /** Roll number within the section. */
    rollNo: z.string().max(64).optional(),
    enrolledDate: isoDateSchema,
    /** Late join: first day the student attends (defaults to `enrolledDate`). */
    startOn: isoDateSchema.nullable().optional(),
    baseFee: z.number().nonnegative().optional().default(0),
    discountType: z.string().optional().default("none"),
    discountLabel: z.string().optional().default(""),
    discountPct: z.number().min(0).max(100).optional().default(0),
    discountAmt: z.number().nonnegative().optional().default(0),
    finalFee: z.number().nonnegative().optional().default(0),
    status: z.enum(ENROLLMENT_STATUSES).optional().default("pending"),
    invoiceId: z.string().nullable().optional(),
    paymentStatus: z.enum(ENROLLMENT_PAYMENT_STATUSES).optional().default("none"),
    notes: z.string().optional().default(""),
    timeline: z.array(enrollmentTimelineItemSchema).optional().default([]),
  })
  .strict();

export const enrollmentRecordUpdateSchema = enrollmentRecordInsertSchema.partial().strict();

export type Enrollment = z.infer<typeof enrollmentRecordSchema>;
export type EnrollmentRecord = Enrollment;
export type EnrollmentInsert = z.infer<typeof enrollmentRecordInsertSchema>;
export type EnrollmentUpdate = z.infer<typeof enrollmentRecordUpdateSchema>;
export const enrollmentListSchema = z.array(enrollmentRecordSchema);

/** Whether an enrollment record is soft-deleted. */
export function isEnrollmentDeleted(enrollment: { deletedAt?: string | null }): boolean {
  return Boolean(enrollment.deletedAt);
}

/** Active directory rows — excludes soft-deleted records from Work by default. */
export function filterActiveEnrollments<T extends { deletedAt?: string | null }>(
  enrollments: T[],
): T[] {
  return enrollments.filter((enrollment) => !isEnrollmentDeleted(enrollment));
}

/** Enrollments module manifest — aligns with globle1 universal module architecture. */

export const ENROLLMENTS_MODULE_MANIFEST = {
  moduleId: "enrollments",
  entityType: "Enrollment",
  collectionKey: "enrollments",
  settingsObjectKey: "enrollments_settings",
  columnPreferencesObjectKey: "enrollment_user_column_preferences",
  restBasePath: "/api/enrollments",
  analyticsCategory: "enrollments",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["preferences"] as const,
  permissions: {
    read: "enrollments.read",
    write: "enrollments.write",
    delete: "enrollments.write",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    export: "enrollments.read",
    reports: "enrollments.read",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["directory", "eligibility"] as const,
    bulkActions: ["cancel", "delete", "export"] as const,
  },
  defaultExportFilename: "enrollments.csv",
  exportChunkSize: 100,
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: true,
    retentionDays: null,
  },
  defaultPageSize: 12,
  maxPageSize: 100,
} as const;

export type EnrollmentsModuleTier = (typeof ENROLLMENTS_MODULE_MANIFEST.tiers)[number];

/**
 * Whether the enrollment counts on `day` (YYYY-MM-DD) for rosters: it holds a seat, or was withdrawn
 * after that day; and the student had started by then (`startOn`, else `enrolledDate`).
 */
export function enrollmentActiveOn(
  enrollment: {
    status: string;
    startOn?: string | null;
    endOn?: string | null;
    enrolledDate?: string | null;
  },
  day: string,
): boolean {
  const start = enrollment.startOn || enrollment.enrolledDate;
  if (start && /^\d{4}-\d{2}-\d{2}/.test(start) && day < start.slice(0, 10)) return false;
  if (enrollmentHoldsSeat(enrollment.status)) return true;
  return (
    enrollment.status === "withdrawn" &&
    Boolean(enrollment.endOn) &&
    day <= String(enrollment.endOn)
  );
}
