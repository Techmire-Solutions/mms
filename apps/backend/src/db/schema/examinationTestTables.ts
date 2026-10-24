import {
  pgTable,
  text,
  timestamp,
  index,
  integer,
  primaryKey,
  foreignKey,
  varchar,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { questions } from "./examinationQuestionBankTables.js";

export const tests = pgTable(
  "tests",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    categoryId: varchar("category_id", { length: 64 }),
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("mixed"),
    duration: integer("duration").notNull().default(60),
    examClass: varchar("exam_class", { length: 120 }),
    /** `session_classes.id`; `examClass` stays as the display snapshot. */
    classId: text("class_id"),
    totalMarks: integer("total_marks"),
    instructions: text("instructions"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("tests_workspace_category_idx").on(table.workspaceSubdomain, table.categoryId),
    index("tests_class_idx").on(table.workspaceSubdomain, table.classId),
    index("tests_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("tests_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("tests_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

export const testQuestions = pgTable(
  "test_questions",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    testId: text("test_id").notNull(),
    questionId: text("question_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.testId, table.questionId] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.testId],
      foreignColumns: [tests.workspaceSubdomain, tests.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.questionId],
      foreignColumns: [questions.workspaceSubdomain, questions.id],
    }).onDelete("cascade"),
    index("test_questions_workspace_test_idx").on(table.workspaceSubdomain, table.testId),
  ],
);

export const testSections = pgTable(
  "test_sections",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    testId: text("test_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    instructions: text("instructions").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.testId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.testId],
      foreignColumns: [tests.workspaceSubdomain, tests.id],
    }).onDelete("cascade"),
    index("test_sections_workspace_test_idx").on(table.workspaceSubdomain, table.testId),
  ],
);

export const testSectionQuestions = pgTable(
  "test_section_questions",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    questionId: text("question_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.sectionId, table.questionId] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.questionId],
      foreignColumns: [questions.workspaceSubdomain, questions.id],
    }).onDelete("cascade"),
    index("test_section_questions_workspace_sec_idx").on(table.workspaceSubdomain, table.sectionId),
  ],
);

export const assessmentResults = pgTable(
  "assessment_results",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    testId: text("test_id").notNull(),
    studentId: varchar("student_id", { length: 64 }).notNull(),
    studentName: varchar("student_name", { length: 255 }).notNull().default(""),
    submittedAt: varchar("submitted_at", { length: 30 }).notNull(),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.testId],
      foreignColumns: [tests.workspaceSubdomain, tests.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("cascade"),
    index("assessment_results_workspace_test_idx").on(table.workspaceSubdomain, table.testId),
    index("assessment_results_workspace_student_idx").on(table.workspaceSubdomain, table.studentId),
    index("assessment_results_workspace_submitted_idx").on(
      table.workspaceSubdomain,
      table.submittedAt,
    ),
    index("assessment_results_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("assessment_results_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("assessment_results_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

export const assessmentAnswers = pgTable(
  "assessment_answers",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    resultId: text("result_id").notNull(),
    questionId: text("question_id").notNull(),
    studentAnswer: text("student_answer").notNull().default(""),
    score: numeric("score", { precision: 8, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.resultId, table.questionId] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.resultId],
      foreignColumns: [assessmentResults.workspaceSubdomain, assessmentResults.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.questionId],
      foreignColumns: [questions.workspaceSubdomain, questions.id],
    }).onDelete("cascade"),
    index("assessment_answers_workspace_res_idx").on(table.workspaceSubdomain, table.resultId),
    index("assessment_answers_workspace_question_idx").on(
      table.workspaceSubdomain,
      table.questionId,
    ),
  ],
);
