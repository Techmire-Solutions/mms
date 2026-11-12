import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { questions } from "./examinationQuestionBankTables.js";
import { tests } from "./examinationTestTables.js";

/**
 * Media attached to a question stem or one of its options (migration 0242).
 *
 * Rows are server-managed: the bulk question save never carries them, and a file is only persisted
 * once the question exists. `url` is the canonical tenant upload path
 * (`/uploads/tenants/<t>/question-media/<file>`), which the orphan sweep treats as a reference.
 */
export const questionAttachments = pgTable(
  "question_attachments",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    /** `stem` (the question text) or `option` (one choice of a choice-based question). */
    kind: varchar("kind", { length: 20 }).notNull().default("stem"),
    /** Index into the question's option list; null for the stem. */
    optionIndex: integer("option_index"),
    name: varchar("name", { length: 255 }).notNull(),
    mime: varchar("mime", { length: 120 }).notNull(),
    size: bigint("size", { mode: "number" }).notNull().default(0),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "question_attachments_pk",
      columns: [table.workspaceSubdomain, table.questionId, table.id],
    }),
    foreignKey({
      name: "question_attachments_question_fk",
      columns: [table.workspaceSubdomain, table.questionId],
      foreignColumns: [questions.workspaceSubdomain, questions.id],
    }).onDelete("cascade"),
    index("question_attachments_ws_question_idx").on(table.workspaceSubdomain, table.questionId),
    // Reference lookup for the uploads delete endpoint and the orphan sweep.
    index("question_attachments_ws_url_idx").on(table.workspaceSubdomain, table.url),
    check("question_attachments_kind_check", sql`${table.kind} IN ('stem', 'option')`),
    check(
      "question_attachments_option_pair_check",
      sql`(${table.kind} = 'option') = (${table.optionIndex} is not null)`,
    ),
  ],
);

/**
 * One bucket of a paper blueprint (migration 0242): the stored form of the assembly request so a
 * generated paper documents what it asked for. `bucket_index` preserves evaluation order, which is
 * part of the deterministic selection.
 */
export const testBlueprintBuckets = pgTable(
  "test_blueprint_buckets",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    testId: text("test_id").notNull(),
    bucketIndex: integer("bucket_index").notNull(),
    categoryId: varchar("category_id", { length: 64 }),
    difficulty: varchar("difficulty", { length: 20 }),
    type: varchar("type", { length: 30 }),
    targetCount: integer("target_count"),
    targetMarks: integer("target_marks"),
  },
  (table) => [
    primaryKey({
      name: "test_blueprint_buckets_pk",
      columns: [table.workspaceSubdomain, table.testId, table.bucketIndex],
    }),
    foreignKey({
      name: "test_blueprint_buckets_test_fk",
      columns: [table.workspaceSubdomain, table.testId],
      foreignColumns: [tests.workspaceSubdomain, tests.id],
    }).onDelete("cascade"),
    check(
      "test_blueprint_buckets_target_check",
      sql`${table.targetCount} is not null or ${table.targetMarks} is not null`,
    ),
    check(
      "test_blueprint_buckets_non_negative_check",
      sql`(${table.targetCount} is null or ${table.targetCount} >= 0) and (${table.targetMarks} is null or ${table.targetMarks} >= 0)`,
    ),
  ],
);
