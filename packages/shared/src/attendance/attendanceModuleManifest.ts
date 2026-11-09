import type { Permission } from "../auth/permissions.js";
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { attendanceAttachmentUrlSchema } from "./attendanceApiSchemas.js";

/**
 * The status domain lives in its own leaf module (no imports) to keep the manifest, the API schemas
 * and the lookup model acyclic. Re-exported here so existing imports keep working.
 */
export {
  ATTENDANCE_ATTENDED_STATUSES,
  ATTENDANCE_RECORD_STATUSES,
  attendanceAttendedStatusSchema,
  attendanceRecordStatusSchema,
  isAttendedStatus,
  isPresentStatus,
  type AttendanceAttendedStatus,
  type AttendanceRecordStatus,
} from "./attendanceStatusDomain.js";
// Also imported for local use (the record schemas below reference the status enum).
import { attendanceRecordStatusSchema } from "./attendanceStatusDomain.js";

export const attendanceRecordSchema = z
  .object({
    id: z.string(),
    classId: z.string(),
    date: z.string(),
    studentId: z.string(),
    studentName: z.string().optional().default(""),
    rollNo: z.string().optional().default(""),
    sessionId: z.string().optional(),
    sessionName: z.string().optional(),
    facultyId: z.string().optional(),
    status: attendanceRecordStatusSchema,
    timeIn: z.string().optional().default(""),
    timeOut: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    /** Server-set: user who last marked the row. */
    markedBy: z.string().nullable().optional(),
    /** Section at marking time (server-stamped from the student's enrollment). */
    sectionId: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    /**
     * Optimistic-concurrency token (`attendance.version`). Echo the value you read; a write whose
     * token is stale is refused with 409 instead of silently overwriting another instructor's save.
     */
    version: z.number().int().optional(),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
    /** Restore provenance — trash rows must carry who/when they came back (mms-soft-delete §6). */
    restoredAt: z.string().nullable().optional(),
    restoredBy: z.string().nullable().optional(),
    deletedWithCascade: z.boolean().optional(),
  })
  .strict();

export const attendanceRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    classId: z.string().min(1, "Class / Session is required"),
    date: isoDateSchema,
    studentId: z.string().min(1, "Student is required"),
    studentName: z.string().optional().default(""),
    rollNo: z.string().optional().default(""),
    status: attendanceRecordStatusSchema.default("present"),
    timeIn: z.string().optional().default(""),
    timeOut: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    /** Optional OCC token for create-or-update; omitted means "last writer wins" (legacy clients). */
    version: z.number().int().optional(),
  })
  .strict();

export const attendanceRecordUpdateSchema = attendanceRecordInsertSchema.partial().strict();

export const attendanceListSchema = z.array(attendanceRecordSchema);

/**
 * Hard cap on one roster save. A class roster is bounded by capacity; an unbounded array let a
 * client push tens of thousands of rows into a single transaction (and a single audit batch).
 * Matches the 500-id cap the soft-delete bulk routes use.
 */
export const ATTENDANCE_BULK_MAX_RECORDS = 500;

/**
 * Byte ceiling for the bulk roster save.
 *
 * 500 records of this shape serialise well under 256 KB; the cap exists so an oversized/malicious
 * body is refused with a 413 before it is parsed, instead of relying on the process-wide body limit
 * and Zod's row count alone.
 */
export const ATTENDANCE_BULK_MAX_BYTES = 512 * 1024;

export const attendanceBulkSchema = z
  .object({
    records: attendanceListSchema.max(ATTENDANCE_BULK_MAX_RECORDS),
    /**
     * Justification for a batch that overrides a lock or the marking cut-off. Required only when
     * the write would otherwise be refused; persisted in the audit row, never on the marks.
     */
    overrideReason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const ATTENDANCE_LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type AttendanceLeaveStatus = (typeof ATTENDANCE_LEAVE_STATUSES)[number];

/** What an excuse is for; drives reporting and the notification copy. */
export const ATTENDANCE_LEAVE_TYPES = ["medical", "personal", "family", "other"] as const;
export type AttendanceLeaveType = (typeof ATTENDANCE_LEAVE_TYPES)[number];

export const attendanceLeaveSchema = z
  .object({
    id: z.string(),
    studentId: z.string().min(1),
    fromDate: isoDateSchema,
    toDate: isoDateSchema,
    reason: z.string().min(1),
    status: z.enum(ATTENDANCE_LEAVE_STATUSES).default("pending"),
    leaveType: z.enum(ATTENDANCE_LEAVE_TYPES).default("other"),
    /** Who filed the request and when (parent, teacher, guardian…). */
    submittedBy: z.string().nullable().optional(),
    submittedAt: z.string().nullable().optional(),
    /** The reviewer's decision record — authoritative over the legacy `approved*` pair. */
    reviewedBy: z.string().nullable().optional(),
    reviewedAt: z.string().nullable().optional(),
    reviewNote: z.string().nullable().optional(),
    cancelledBy: z.string().nullable().optional(),
    cancelledAt: z.string().nullable().optional(),
    /** Free-form reference to a medical certificate (file name/id) held by the documents module. */
    documentRef: z.string().nullable().optional(),
    /** Legacy approval pair, still written by enrollment suspension. */
    approvedBy: z.string().nullable().optional(),
    approvedAt: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const attendanceLeaveInsertSchema = z
  .object({
    id: z.string().optional(),
    studentId: z.string().min(1, "Student is required"),
    fromDate: isoDateSchema,
    toDate: isoDateSchema,
    reason: z.string().min(1, "Reason is required"),
    leaveType: z.enum(ATTENDANCE_LEAVE_TYPES).default("other"),
    /** Must be a real tenant attachment URL (medical certificate); the use case re-checks the tenant. */
    documentRef: attendanceAttachmentUrlSchema.optional(),
    notes: z.string().optional().default(""),
  })
  .strict()
  .refine((value) => value.toDate >= value.fromDate, {
    message: "The leave end date cannot be before its start date",
    path: ["toDate"],
  });

/** Reviewer decision on a pending excuse. */
export const attendanceLeaveReviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

/** Revoking an approved excuse (or withdrawing one's own pending request). */
export const attendanceLeaveCancelSchema = z
  .object({ reason: z.string().trim().max(500).optional() })
  .strict();

export const attendanceLeaveListQuerySchema = z
  .object({
    status: z.enum(ATTENDANCE_LEAVE_STATUSES).optional(),
    studentId: z.string().trim().max(64).optional(),
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
    /** Bounded page size for the review queue; the repository caps at the same value. */
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type AttendanceRecordInsert = z.infer<typeof attendanceRecordInsertSchema>;
export type AttendanceRecordUpdate = z.infer<typeof attendanceRecordUpdateSchema>;
export type AttendanceLeave = z.infer<typeof attendanceLeaveSchema>;
export type AttendanceLeaveInsert = z.infer<typeof attendanceLeaveInsertSchema>;
export type AttendanceLeaveReview = z.infer<typeof attendanceLeaveReviewSchema>;
export type AttendanceLeaveCancel = z.infer<typeof attendanceLeaveCancelSchema>;
export type AttendanceLeaveListQuery = z.infer<typeof attendanceLeaveListQuerySchema>;

/** Attendance module manifest — aligns with globle1 universal module architecture. */
export const ATTENDANCE_MODULE_MANIFEST = {
  moduleId: "attendance",
  entityType: "AttendanceRecord",
  collectionKey: "attendance_records",
  settingsObjectKey: "attendance_settings",
  columnPreferencesObjectKey: "attendance_user_column_preferences",
  restBasePath: "/api/attendance",
  analyticsCategory: "attendance",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["calendar", "preferences"] as const,
  permissions: {
    read: "analytics.view",
    write: "attendance.write",
    delete: "users.manage",
    setupView: "settings.global.write",
    setupWrite: "settings.global.write",
    export: "analytics.view",
    reports: "analytics.view",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["mark", "records", "audit"] as const,
    bulkActions: ["delete"] as const,
  },
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: true,
    retentionDays: null,
  },
  defaultPageSize: 15,
  maxPageSize: 100,
  /** CSV export defaults (job runner + route). */
  defaultExportFilename: "attendance.csv",
  exportChunkSize: 500,
} as const;

export type AttendanceModuleTier = (typeof ATTENDANCE_MODULE_MANIFEST.tiers)[number];

export function isAttendanceRecordDeleted(record: { deletedAt?: string | null }): boolean {
  return Boolean(record.deletedAt);
}

export function filterActiveAttendanceRecords<T extends { deletedAt?: string | null }>(
  records: T[],
): T[] {
  return records.filter((record) => !isAttendanceRecordDeleted(record));
}
