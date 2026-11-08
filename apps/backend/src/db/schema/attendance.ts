import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  jsonb,
  primaryKey,
  foreignKey,
  varchar,
  date,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";
import { sessionClasses } from "./sessions.js";
import { sessionClassSections } from "./sessionSections.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

export const attendance = pgTable(
  "attendance",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    classId: varchar("class_id", { length: 64 }).notNull(),
    /** Section at marking time (kept when the student later transfers). */
    sectionId: text("section_id"),
    studentId: varchar("student_id", { length: 64 }).notNull(),
    studentName: varchar("student_name", { length: 255 }).notNull().default(""),
    rollNo: varchar("roll_no", { length: 64 }).notNull().default(""),
    /**
     * The day, read and written as the `date_on` column since migration 0181; the legacy varchar
     * `date` is filled by a trigger until release B (0182) drops it.
     */
    date: date("date_on", { mode: "string" }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("present"),
    timeIn: varchar("time_in", { length: 10 }).notNull().default(""),
    timeOut: varchar("time_out", { length: 10 }).notNull().default(""),
    notes: text("notes").notNull().default(""),
    /** User who last marked this row (teacher of record is resolved from section staff by date). */
    markedBy: text("marked_by"),
    /**
     * Soft-delete sextuple. Migration 0108 added every column, but this table hand-rolled only
     * three of them until now, so `restored_at` / `restored_by` / `deleted_with_cascade` were
     * invisible to the ORM and absent from every Drizzle snapshot (migration 0218 reconciles it).
     */
    ...softDeleteColumns,
    /** Generated column: TTL sentinel = deleted_at + 10 years (retentionDays = null/indefinite per §13.4; future-proofs purge worker). */
    purgeAfter: timestamp("purge_after", { withTimezone: true, mode: "date" }).generatedAlwaysAs(
      sql`deleted_at + INTERVAL '3650 days'`,
    ),
    /**
     * Optimistic-concurrency token, incremented by every write (migration 0218; mirrors
     * `sessions.version` / `session_classes.version` from 0206). Two instructors editing the same
     * roster therefore get a 409 instead of a silent last-write-wins overwrite.
     */
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    /**
     * Business key for one mark per student, class and day.
     *
     * `section_id` is deliberately NOT part of this key: it is a server-stamped record of the
     * student's section *on the attendance date*, so a mid-term section transfer must not permit a
     * second mark for the same day. Adding it here re-opens duplicate daily attendance after a
     * transfer — see docs/attendance-schema-persistence-audit-2026-11-08.md.
     */
    uniqueIndex("attendance_workspace_class_student_date_on_uidx")
      .on(table.workspaceSubdomain, table.classId, table.studentId, table.date)
      .where(sql`${table.deletedAt} is null`),
    index("attendance_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("attendance_workspace_date_on_idx").on(table.workspaceSubdomain, table.date),
    index("attendance_workspace_status_idx").on(table.workspaceSubdomain, table.status),
    index("attendance_workspace_class_date_on_active_idx")
      .on(table.workspaceSubdomain, table.classId, table.date)
      .where(sql`${table.deletedAt} is null`),
    index("attendance_workspace_class_date_on_status_active_idx")
      .on(table.workspaceSubdomain, table.classId, table.date, table.status)
      .where(sql`${table.deletedAt} is null`),
    foreignKey({
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("cascade"),
    index("attendance_workspace_student_idx").on(table.workspaceSubdomain, table.studentId),
    foreignKey({
      name: "attendance_class_fk",
      columns: [table.workspaceSubdomain, table.classId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "attendance_section_fk",
      columns: [table.workspaceSubdomain, table.sectionId],
      foreignColumns: [sessionClassSections.workspaceSubdomain, sessionClassSections.id],
    }).onDelete("restrict"),
    index("attendance_workspace_section_idx").on(table.workspaceSubdomain, table.sectionId),
    index("attendance_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("attendance_workspace_updated_at_active_idx")
      .on(table.workspaceSubdomain, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    /**
     * Status domain (migration 0218). Mirrors `ATTENDANCE_RECORD_STATUSES` in @mms/shared; before
     * this a typo'd or differently-cased status silently dropped the row out of every present /
     * absent rate, which is why the reports defensively `lower(trim(...))` the column.
     */
    check(
      "attendance_status_check",
      sql`${table.status} IN ('present', 'absent', 'late', 'excused')`,
    ),
    index("attendance_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    /** Planner-efficient index for purge worker candidate selection (§13.2). */
    index("attendance_purge_after_idx")
      .on(table.workspaceSubdomain, table.purgeAfter)
      .where(sql`${table.deletedAt} is not null and ${table.purgeAfter} is not null`),
  ],
);

export const attendanceLeaves = pgTable(
  "attendance_leaves",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 64 }).notNull(),
    fromDate: date("from_date", { mode: "string" }),
    toDate: date("to_date", { mode: "string" }),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** medical | personal | family | other (migration 0220). */
    leaveType: varchar("leave_type", { length: 20 }).notNull().default("other"),
    submittedBy: text("submitted_by"),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    /** The reviewer's decision record — authoritative over the legacy `approved*` pair. */
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    reviewNote: varchar("review_note", { length: 500 }),
    cancelledBy: text("cancelled_by"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    /** Free-form reference to a medical certificate held by the documents module. */
    documentRef: text("document_ref"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("cascade"),
    check(
      "attendance_leaves_status_check",
      sql`${table.status} IN ('pending', 'approved', 'rejected', 'cancelled')`,
    ),
    check(
      "attendance_leaves_type_check",
      sql`${table.leaveType} IN ('medical', 'personal', 'family', 'other')`,
    ),
    // An approval without a decision record is unattributable evidence (migration 0220 backfills
    // the legacy `approved_by/at` pair before this is validated).
    check(
      "attendance_leaves_approved_reviewed_check",
      sql`${table.status} <> 'approved' OR ${table.reviewedAt} IS NOT NULL`,
    ),
    index("attendance_leaves_workspace_student_idx").on(table.workspaceSubdomain, table.studentId),
    index("attendance_leaves_workspace_date_idx").on(
      table.workspaceSubdomain,
      table.fromDate,
      table.toDate,
    ),
    index("attendance_leaves_workspace_status_date_idx").on(
      table.workspaceSubdomain,
      table.status,
      table.fromDate,
    ),
  ],
);

export const attendanceLookups = pgTable(
  "attendance_lookups",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'statuses'
    label: text("label").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    uniqueIndex("attendance_lookups_workspace_kind_sort_idx").on(
      table.workspaceSubdomain,
      table.kind,
      table.sortOrder,
    ),
    index("attendance_lookups_workspace_kind_idx").on(table.workspaceSubdomain, table.kind),
  ],
);

/** Attendance Setup field registry (was document-store `attendance_settings` fields slice). */
export const attendanceFieldConfigs = pgTable(
  "attendance_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Attendance Setup preferences (was document-store `attendance_settings` prefs slice). */
export const attendanceModulePreferences = pgTable(
  "attendance_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Per-user Attendance Work column layout (was document-store `attendance_user_column_preferences`). */
/** Roster-day submission (0219) and chronic-absence alerts (0221) live in their own module. */
export * from "./attendanceLifecycleTables.js";

/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type AttendanceRow = typeof attendance.$inferSelect;
export type InsertAttendanceRow = typeof attendance.$inferInsert;
export type AttendanceLeaveRow = typeof attendanceLeaves.$inferSelect;
export type InsertAttendanceLeaveRow = typeof attendanceLeaves.$inferInsert;
export type AttendanceLookupsRow = typeof attendanceLookups.$inferSelect;
export type InsertAttendanceLookupsRow = typeof attendanceLookups.$inferInsert;
export type AttendanceFieldConfigsRow = typeof attendanceFieldConfigs.$inferSelect;
export type InsertAttendanceFieldConfigsRow = typeof attendanceFieldConfigs.$inferInsert;
export type AttendanceModulePreferencesRow = typeof attendanceModulePreferences.$inferSelect;
export type InsertAttendanceModulePreferencesRow = typeof attendanceModulePreferences.$inferInsert;
