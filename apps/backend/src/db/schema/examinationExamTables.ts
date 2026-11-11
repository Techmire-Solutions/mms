import {
  pgTable,
  text,
  timestamp,
  index,
  integer,
  primaryKey,
  foreignKey,
  varchar,
  date,
  numeric,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { subjects } from "./academicCatalogs.js";
import { sessionClasses } from "./sessions.js";

export const exams = pgTable(
  "exams",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 150 }).notNull(),
    subjectId: text("subject_id"),
    totalMarks: integer("total_marks").notNull().default(100),
    passingMarks: integer("passing_marks").notNull().default(50),
    date: date("date", { mode: "string" }),
    duration: integer("duration").notNull().default(60),
    status: varchar("status", { length: 20 }).notNull().default("upcoming"),
    /** Set when the exam is finalised; completion may only count finalized results (migration 0207). */
    resultsFinalizedAt: timestamp("results_finalized_at", {
      withTimezone: true,
      mode: "date",
    }),
    description: text("description").notNull().default(""),
    /**
     * Minimum attendance (one-decimal %) a student needs to sit this exam (migration 0222).
     * `null` inherits `sessions.min_attendance_pct`; 0 disables the gate.
     */
    minAttendancePct: numeric("min_attendance_pct", { precision: 5, scale: 2, mode: "number" }),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      name: "exams_subject_fk",
      columns: [table.workspaceSubdomain, table.subjectId],
      foreignColumns: [subjects.workspaceSubdomain, subjects.id],
    }).onDelete("restrict"),
    // Range/domain guards (migration 0236, added NOT VALID so legacy rows are not rewritten).
    check(
      "exams_min_attendance_pct_check",
      sql`${table.minAttendancePct} IS NULL OR (${table.minAttendancePct} >= 0 AND ${table.minAttendancePct} <= 100)`,
    ),
    check("exams_total_marks_positive_check", sql`${table.totalMarks} > 0`),
    check(
      "exams_passing_marks_range_check",
      sql`${table.passingMarks} >= 0 AND ${table.passingMarks} <= ${table.totalMarks}`,
    ),
    check("exams_duration_positive_check", sql`${table.duration} > 0`),
    check(
      "exams_status_check",
      sql`${table.status} in ('upcoming', 'scheduled', 'ongoing', 'completed', 'cancelled')`,
    ),
    index("exams_workspace_subject_idx").on(table.workspaceSubdomain, table.subjectId),
    index("exams_workspace_date_idx").on(table.workspaceSubdomain, table.date),
    index("exams_workspace_status_idx").on(table.workspaceSubdomain, table.status),
    // Exists since 0207 (`exams_workspace_unfinalized_idx`); mirrored in 0238 so the declared
    // shape matches the database the completion queries run against.
    index("exams_workspace_unfinalized_idx")
      .on(table.workspaceSubdomain, table.status)
      .where(sql`${table.resultsFinalizedAt} is null and ${table.deletedAt} is null`),
    index("exams_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("exams_workspace_updated_at_active_idx")
      .on(table.workspaceSubdomain, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    index("exams_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("exams_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

export const examClasses = pgTable(
  "exam_classes",
  {
    examId: text("exam_id").notNull(),
    classId: varchar("class_id", { length: 64 }).notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.examId, table.classId] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.examId],
      foreignColumns: [exams.workspaceSubdomain, exams.id],
    }).onDelete("cascade"),
    index("exam_classes_workspace_exam_idx").on(table.workspaceSubdomain, table.examId),
    index("exam_classes_workspace_class_idx").on(table.workspaceSubdomain, table.classId),
    foreignKey({
      name: "exam_classes_class_fk",
      columns: [table.workspaceSubdomain, table.classId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("restrict"),
  ],
);

export const examResults = pgTable(
  "exam_results",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    examId: text("exam_id").notNull(),
    studentId: varchar("student_id", { length: 64 }).notNull(),
    /**
     * Marks are decimal: the entry grid asks for decimals (`inputMode="decimal"`) and a whole-number
     * column turned `85.5` into a 500. `numeric(8,2)` matches `assessment_answers.score` and the
     * DTO bound `MAX_MARKS_OBTAINED`. Migration 0236.
     */
    marksObtained: numeric("marks_obtained", { precision: 8, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    /**
     * Optimistic-concurrency token, incremented by every write (migration 0236; mirrors
     * `attendance.version`). Two examiners grading the same roster get a 409 instead of a silent
     * last-write-wins overwrite of someone else's scores.
     */
    version: integer("version").notNull().default(1),
    markedBy: text("marked_by"),
    /**
     * Audited moderation adjustment (migration 0237). Effective score = `marksObtained + graceMarks`;
     * the raw mark is never rewritten, so a moderated result remains explainable.
     */
    graceMarks: numeric("grace_marks", { precision: 6, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    moderationReason: varchar("moderation_reason", { length: 500 }),
    moderatedBy: text("moderated_by"),
    moderatedAt: timestamp("moderated_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.examId],
      foreignColumns: [exams.workspaceSubdomain, exams.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("cascade"),
    // `exam_results_workspace_exam_idx` was dropped by migration 0236: it is an exact prefix of the
    // unique index below, which already serves exam-scoped lookups.
    index("exam_results_workspace_student_idx").on(table.workspaceSubdomain, table.studentId),
    // One result per student per exam (migration 0222): the surrogate-id upsert allowed duplicates.
    uniqueIndex("exam_results_workspace_exam_student_uidx").on(
      table.workspaceSubdomain,
      table.examId,
      table.studentId,
    ),
    check("exam_results_marks_non_negative_check", sql`${table.marksObtained} >= 0`),
    check("exam_results_grace_non_negative_check", sql`${table.graceMarks} >= 0`),
    check(
      "exam_results_moderation_reason_check",
      sql`${table.graceMarks} = 0 OR btrim(coalesce(${table.moderationReason}, '')) <> ''`,
    ),
  ],
);

/**
 * Audited attendance override that lets one student sit one exam despite the threshold
 * (migration 0222). Cancelling revokes it without deleting the evidence.
 */
export const examEligibilityOverrides = pgTable(
  "exam_eligibility_overrides",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    examId: text("exam_id").notNull(),
    studentId: varchar("student_id", { length: 64 }).notNull(),
    reason: varchar("reason", { length: 500 }).notNull(),
    grantedBy: text("granted_by"),
    grantedAt: timestamp("granted_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    revokedBy: text("revoked_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.examId, table.studentId] }),
    foreignKey({
      name: "exam_eligibility_overrides_exam_fk",
      columns: [table.workspaceSubdomain, table.examId],
      foreignColumns: [exams.workspaceSubdomain, exams.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "exam_eligibility_overrides_student_fk",
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("cascade"),
    index("exam_eligibility_overrides_workspace_student_idx").on(
      table.workspaceSubdomain,
      table.studentId,
    ),
  ],
);
