import {
  pgTable,
  text,
  timestamp,
  index,
  integer,
  primaryKey,
  foreignKey,
  varchar,
  check,
  uniqueIndex,
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
    /** Authoring lifecycle (0241). Server-owned: never written by the generic bulk save. */
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    /** OCC token (0240): a save carrying a stale version writes nothing and returns 409. */
    version: integer("version").notNull().default(1),
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
    // 0240: the list/blueprint filter key and the default `updated_at DESC` order. Without the sort
    // index every default page top-N-sorts the tenant's whole question set.
    index("questions_ws_active_difficulty_type_idx")
      .on(table.workspaceSubdomain, table.difficulty, table.type)
      .where(sql`${table.deletedAt} is null`),
    index("questions_ws_updated_active_idx")
      .on(table.workspaceSubdomain, table.updatedAt.desc())
      .where(sql`${table.deletedAt} is null`),
    index("questions_ws_active_status_updated_idx")
      .on(table.workspaceSubdomain, table.status, table.updatedAt.desc())
      .where(sql`${table.deletedAt} is null`),
    index("questions_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    check("questions_marks_positive_check", sql`${table.marks} > 0`),
    check("questions_version_positive_check", sql`${table.version} > 0`),
    check(
      "questions_status_check",
      sql`${table.status} IN ('draft', 'under_review', 'approved', 'retired')`,
    ),
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
    // Replaces `question_options_workspace_q_idx` (0240): same leading columns, plus the ordering
    // guarantee the column previously only had by convention.
    uniqueIndex("question_options_ws_q_index_uidx").on(
      table.workspaceSubdomain,
      table.questionId,
      table.optionIndex,
    ),
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
    // Declared in 0240: migration 0090 created this index but it was never mirrored, so a rebuilt
    // database silently lost it (the round-2 F6 drift class).
    index("question_citations_workspace_book_idx").on(table.workspaceSubdomain, table.bookId),
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
