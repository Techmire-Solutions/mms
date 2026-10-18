import type { Permission } from './permissions.js';
import { z } from 'zod';
import { isoDateSchema } from './isoDateSchema.js';

export const ATTENDANCE_RECORD_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceRecordStatus = (typeof ATTENDANCE_RECORD_STATUSES)[number];

export const attendanceRecordStatusSchema = z.enum(ATTENDANCE_RECORD_STATUSES);

export const attendanceRecordSchema = z
  .object({
    id: z.string(),
    classId: z.string(),
    date: z.string(),
    studentId: z.string(),
    studentName: z.string().optional().default(''),
    rollNo: z.string().optional().default(''),
    sessionId: z.string().optional(),
    sessionName: z.string().optional(),
    facultyId: z.string().optional(),
    status: attendanceRecordStatusSchema,
    timeIn: z.string().optional().default(''),
    timeOut: z.string().optional().default(''),
    notes: z.string().optional().default(''),
    /** Server-set: user who last marked the row. */
    markedBy: z.string().nullable().optional(),
    /** Section at marking time (server-stamped from the student's enrollment). */
    sectionId: z.string().nullable().optional(),
    customFields: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
  })
  .strict();

export const attendanceRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    classId: z.string().min(1, 'Class / Session is required'),
    date: isoDateSchema,
    studentId: z.string().min(1, 'Student is required'),
    studentName: z.string().optional().default(''),
    rollNo: z.string().optional().default(''),
    status: attendanceRecordStatusSchema.default('present'),
    timeIn: z.string().optional().default(''),
    timeOut: z.string().optional().default(''),
    notes: z.string().optional().default(''),
    customFields: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const attendanceRecordUpdateSchema = attendanceRecordInsertSchema.partial().strict();

export const attendanceListSchema = z.array(attendanceRecordSchema);

export const attendanceBulkSchema = z
  .object({
    records: attendanceListSchema,
  })
  .strict();

export const ATTENDANCE_LEAVE_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type AttendanceLeaveStatus = (typeof ATTENDANCE_LEAVE_STATUSES)[number];

export const attendanceLeaveSchema = z
  .object({
    id: z.string(),
    studentId: z.string().min(1),
    fromDate: isoDateSchema,
    toDate: isoDateSchema,
    reason: z.string().min(1),
    status: z.enum(ATTENDANCE_LEAVE_STATUSES).default('pending'),
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
    studentId: z.string().min(1, 'Student is required'),
    fromDate: isoDateSchema,
    toDate: isoDateSchema,
    reason: z.string().min(1, 'Reason is required'),
    notes: z.string().optional().default(''),
  })
  .strict();

export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type AttendanceRecordInsert = z.infer<typeof attendanceRecordInsertSchema>;
export type AttendanceRecordUpdate = z.infer<typeof attendanceRecordUpdateSchema>;
export type AttendanceLeave = z.infer<typeof attendanceLeaveSchema>;
export type AttendanceLeaveInsert = z.infer<typeof attendanceLeaveInsertSchema>;


/** Attendance module manifest — aligns with globle1 universal module architecture. */
export const ATTENDANCE_MODULE_MANIFEST = {
  moduleId: 'attendance',
  entityType: 'AttendanceRecord',
  collectionKey: 'attendance_records',
  settingsObjectKey: 'attendance_settings',
  columnPreferencesObjectKey: 'attendance_user_column_preferences',
  restBasePath: '/api/attendance',
  analyticsCategory: 'attendance',
  tiers: ['work', 'reports', 'setup'] as const,
  setupSubTabs: ['calendar', 'preferences'] as const,
  permissions: {
    read: 'analytics.view',
    write: 'attendance.write',
    delete: 'users.manage',
    setupView: 'settings.global.write',
    setupWrite: 'settings.global.write',
    export: 'analytics.view',
    reports: 'analytics.view',
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ['mark', 'records', 'audit'] as const,
    bulkActions: ['delete'] as const,
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
} as const;

export type AttendanceModuleTier = (typeof ATTENDANCE_MODULE_MANIFEST.tiers)[number];

export function isAttendanceRecordDeleted(record: { deletedAt?: string | null }): boolean {
  return Boolean(record.deletedAt);
}

export function filterActiveAttendanceRecords<T extends { deletedAt?: string | null }>(records: T[]): T[] {
  return records.filter((record) => !isAttendanceRecordDeleted(record));
}
