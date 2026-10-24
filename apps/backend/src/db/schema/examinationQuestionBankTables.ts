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
import { softDeleteColumns } from "./softDeleteSchema.js";

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

export {
  tests,
  testQuestions,
  testSections,
  testSectionQuestions,
  assessmentResults,
  assessmentAnswers,
} from "./examinationTestTables.js";
