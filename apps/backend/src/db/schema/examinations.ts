import {
  pgTable,
  text,
  timestamp,
  index,
  integer,
  jsonb,
  primaryKey,
  foreignKey,
  varchar,
  numeric,
  date,
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
    description: text("description").notNull().default(""),
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
    index("exams_workspace_subject_idx").on(table.workspaceSubdomain, table.subjectId),
    index("exams_workspace_date_idx").on(table.workspaceSubdomain, table.date),
    index("exams_workspace_status_idx").on(table.workspaceSubdomain, table.status),
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
    marksObtained: integer("marks_obtained").notNull().default(0),
    markedBy: text("marked_by"),
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

export const questions = pgTable(
  "questions",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).notNull(),
    difficulty: varchar("difficulty", { length: 20 }).notNull(),
    questionLanguage: varchar("question_language", { length: 10 }).notNull().default("en"),
    text: text("text").notNull(),
    answer: text("answer").notNull(),
    marks: integer("marks").notNull().default(1),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("questions_workspace_type_idx").on(table.workspaceSubdomain, table.type),
    index("questions_workspace_difficulty_idx").on(table.workspaceSubdomain, table.difficulty),
    index("questions_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("questions_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("questions_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

export const questionCategories = pgTable(
  "question_categories",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    categoryId: varchar("category_id", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.questionId, table.categoryId] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.questionId],
      foreignColumns: [questions.workspaceSubdomain, questions.id],
    }).onDelete("cascade"),
    index("question_categories_workspace_q_idx").on(table.workspaceSubdomain, table.questionId),
    index("question_categories_workspace_cat_idx").on(table.workspaceSubdomain, table.categoryId),
  ],
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    optionIndex: integer("option_index").notNull(),
    optionText: text("option_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.questionId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.questionId],
      foreignColumns: [questions.workspaceSubdomain, questions.id],
    }).onDelete("cascade"),
    index("question_options_workspace_q_idx").on(table.workspaceSubdomain, table.questionId),
  ],
);

export const questionTags = pgTable(
  "question_tags",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    tag: varchar("tag", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.questionId, table.tag] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.questionId],
      foreignColumns: [questions.workspaceSubdomain, questions.id],
    }).onDelete("cascade"),
    index("question_tags_workspace_q_idx").on(table.workspaceSubdomain, table.questionId),
  ],
);

export const questionCitations = pgTable(
  "question_citations",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    bookId: text("book_id").notNull(),
    citation: text("citation").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.questionId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.questionId],
      foreignColumns: [questions.workspaceSubdomain, questions.id],
    }).onDelete("cascade"),
    index("question_citations_workspace_q_idx").on(table.workspaceSubdomain, table.questionId),
  ],
);

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
  ],
);

export const examinationsFieldConfigs = pgTable(
  "examinations_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

export const examinationsModulePreferences = pgTable(
  "examinations_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Per-user Examinations exams Work column layout (was document-store `examination_exam_user_column_preferences`). */
/** Per-user Examinations results Work column layout (was document-store `examination_results_user_column_preferences`). */
export const questionBankFieldConfigs = pgTable(
  "question_bank_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

export const questionBankModulePreferences = pgTable(
  "question_bank_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/** Per-user Question Bank Work column layout (was document-store `question_bank_user_column_preferences`). */
/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type ExamRow = typeof exams.$inferSelect;
export type InsertExamRow = typeof exams.$inferInsert;
export type ExamClassRow = typeof examClasses.$inferSelect;
export type InsertExamClassRow = typeof examClasses.$inferInsert;
export type ExamResultRow = typeof examResults.$inferSelect;
export type InsertExamResultRow = typeof examResults.$inferInsert;
export type QuestionRow = typeof questions.$inferSelect;
export type InsertQuestionRow = typeof questions.$inferInsert;
export type QuestionCategoryRow = typeof questionCategories.$inferSelect;
export type InsertQuestionCategoryRow = typeof questionCategories.$inferInsert;
export type QuestionOptionRow = typeof questionOptions.$inferSelect;
export type InsertQuestionOptionRow = typeof questionOptions.$inferInsert;
export type QuestionTagRow = typeof questionTags.$inferSelect;
export type InsertQuestionTagRow = typeof questionTags.$inferInsert;
export type QuestionCitationRow = typeof questionCitations.$inferSelect;
export type InsertQuestionCitationRow = typeof questionCitations.$inferInsert;
export type TestRow = typeof tests.$inferSelect;
export type InsertTestRow = typeof tests.$inferInsert;
export type TestQuestionRow = typeof testQuestions.$inferSelect;
export type InsertTestQuestionRow = typeof testQuestions.$inferInsert;
export type TestSectionRow = typeof testSections.$inferSelect;
export type InsertTestSectionRow = typeof testSections.$inferInsert;
export type TestSectionQuestionRow = typeof testSectionQuestions.$inferSelect;
export type InsertTestSectionQuestionRow = typeof testSectionQuestions.$inferInsert;
export type AssessmentResultRow = typeof assessmentResults.$inferSelect;
export type InsertAssessmentResultRow = typeof assessmentResults.$inferInsert;
export type AssessmentAnswerRow = typeof assessmentAnswers.$inferSelect;
export type InsertAssessmentAnswerRow = typeof assessmentAnswers.$inferInsert;
export type ExaminationsFieldConfigsRow = typeof examinationsFieldConfigs.$inferSelect;
export type InsertExaminationsFieldConfigsRow = typeof examinationsFieldConfigs.$inferInsert;
export type ExaminationsModulePreferencesRow = typeof examinationsModulePreferences.$inferSelect;
export type InsertExaminationsModulePreferencesRow =
  typeof examinationsModulePreferences.$inferInsert;
export type QuestionBankFieldConfigsRow = typeof questionBankFieldConfigs.$inferSelect;
export type InsertQuestionBankFieldConfigsRow = typeof questionBankFieldConfigs.$inferInsert;
export type QuestionBankModulePreferencesRow = typeof questionBankModulePreferences.$inferSelect;
export type InsertQuestionBankModulePreferencesRow =
  typeof questionBankModulePreferences.$inferInsert;
