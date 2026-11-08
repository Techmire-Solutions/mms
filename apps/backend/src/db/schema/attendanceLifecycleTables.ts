import {
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";
import { sessionClasses } from "./sessions.js";

/**
 * Attendance lifecycle tables: roster-day submission state (0219) and chronic-absence alerts (0221).
 * Split from `attendance.ts` for the 300-line band; re-exported from there.
 */

/**
 * One row per class and teaching day: the roster's submission state (migration 0219).
 *
 * `lockAfterSubmit` was a configurable preference with nothing to enforce it — the grid kept the
 * "submitted" flag in React state only. This table is that missing state: a day is locked while
 * `submitted_at` is newer than `reopened_at` (see `isAttendanceDayLocked`).
 */
export const attendanceDaySubmissions = pgTable(
  "attendance_day_submissions",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    classId: text("class_id").notNull(),
    date: date("date_on", { mode: "string" }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    submittedBy: text("submitted_by"),
    reopenedAt: timestamp("reopened_at", { withTimezone: true, mode: "date" }),
    reopenedBy: text("reopened_by"),
    reopenReason: varchar("reopen_reason", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.classId, table.date] }),
    foreignKey({
      name: "attendance_day_submissions_class_fk",
      columns: [table.workspaceSubdomain, table.classId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("restrict"),
    index("attendance_day_submissions_workspace_date_idx").on(table.workspaceSubdomain, table.date),
  ],
);

/** A submission locks the day until it is explicitly reopened. */
export function isAttendanceDayLocked(row: {
  submittedAt?: Date | string | null;
  reopenedAt?: Date | string | null;
}): boolean {
  if (!row.submittedAt) return false;
  if (!row.reopenedAt) return true;
  return new Date(row.submittedAt).getTime() > new Date(row.reopenedAt).getTime();
}

/**
 * One audited escalation per chronic-absence streak (migration 0221).
 *
 * The unique key `(workspace, class, student, streak_start)` is the daily scan's idempotency key: a
 * re-run of the same day finds the alert already recorded and notifies nobody twice.
 */
export const attendanceAbsenceAlerts = pgTable(
  "attendance_absence_alerts",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    classId: varchar("class_id", { length: 64 }).notNull(),
    studentId: varchar("student_id", { length: 64 }).notNull(),
    streakStart: date("streak_start", { mode: "string" }).notNull(),
    streakEnd: date("streak_end", { mode: "string" }).notNull(),
    streakLength: integer("streak_length").notNull(),
    threshold: integer("threshold").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    notifiedAt: timestamp("notified_at", { withTimezone: true, mode: "date" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    resolvedBy: text("resolved_by"),
    resolutionNote: varchar("resolution_note", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      name: "attendance_absence_alerts_class_fk",
      columns: [table.workspaceSubdomain, table.classId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "attendance_absence_alerts_student_fk",
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("cascade"),
    check(
      "attendance_absence_alerts_status_check",
      sql`${table.status} IN ('open', 'resolved', 'dismissed')`,
    ),
    check("attendance_absence_alerts_length_check", sql`${table.streakLength} >= 1`),
    uniqueIndex("attendance_absence_alerts_streak_uidx").on(
      table.workspaceSubdomain,
      table.classId,
      table.studentId,
      table.streakStart,
    ),
    index("attendance_absence_alerts_workspace_status_idx").on(
      table.workspaceSubdomain,
      table.status,
      table.streakEnd,
    ),
    index("attendance_absence_alerts_workspace_student_idx").on(
      table.workspaceSubdomain,
      table.studentId,
    ),
  ],
);
