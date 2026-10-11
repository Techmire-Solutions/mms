import {
  pgTable,
  text,
  timestamp,
  index,
  integer,
  primaryKey,
  foreignKey,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

export const exams = pgTable(
  "exams",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 150 }).notNull(),
    subject: varchar("subject", { length: 120 }).notNull().default(""),
    totalMarks: integer("total_marks").notNull().default(100),
    passingMarks: integer("passing_marks").notNull().default(50),
    date: varchar("date", { length: 10 }).notNull(),
    duration: integer("duration").notNull().default(60),
    status: varchar("status", { length: 20 }).notNull().default("upcoming"),
    description: text("description").notNull().default(""),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("exams_workspace_date_idx").on(table.workspaceSubdomain, table.date),
    index("exams_workspace_status_idx").on(table.workspaceSubdomain, table.status),
    index("exams_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
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
    marksObtained: integer("marks_obtained").notNull().default(0),
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
    index("exam_results_workspace_exam_idx").on(table.workspaceSubdomain, table.examId),
    index("exam_results_workspace_student_idx").on(table.workspaceSubdomain, table.studentId),
  ],
);
