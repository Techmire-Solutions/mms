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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";
import { sessionClasses } from "./sessions.js";
import { sessionClassSections } from "./sessionSections.js";

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
     * The day, read and written as the `date_on` column since migration 0179; the legacy varchar
     * `date` is filled by a trigger until release B (0180) drops it.
     */
    date: date("date_on", { mode: "string" }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("present"),
    timeIn: varchar("time_in", { length: 10 }).notNull().default(""),
    timeOut: varchar("time_out", { length: 10 }).notNull().default(""),
    notes: text("notes").notNull().default(""),
    /** User who last marked this row (teacher of record is resolved from section staff by date). */
    markedBy: text("marked_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    deletedBy: text("deleted_by"),
    deletionReason: varchar("deletion_reason", { length: 500 }),
    /** Generated column: TTL sentinel = deleted_at + 10 years (retentionDays = null/indefinite per §13.4; future-proofs purge worker). */
    purgeAfter: timestamp("purge_after", { withTimezone: true, mode: "date" }).generatedAlwaysAs(
      sql`deleted_at + INTERVAL '3650 days'`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
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
    index("attendance_leaves_workspace_student_idx").on(table.workspaceSubdomain, table.studentId),
    index("attendance_leaves_workspace_date_idx").on(
      table.workspaceSubdomain,
      table.fromDate,
      table.toDate,
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
