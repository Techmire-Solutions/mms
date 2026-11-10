import {
  date,
  pgTable,
  text,
  timestamp,
  index,
  integer,
  boolean,
  jsonb,
  primaryKey,
  varchar,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";
import { faculty } from "./faculty.js";
import { sessionClasses, sessions } from "./sessions.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

/**
 * Hasanat module tables.
 *
 * Deletion taxonomy for this module (`docs/soft-delete.md` §2.9):
 * - `hasanat_distributions` is a soft-deletable entity (sextuple + Category A/B/C indexes +
 *   `forbid_hard_delete` guard).
 * - `hasanat_redemptions` is an append-only point ledger: no `deleted_at`, guarded against hard
 *   delete, and read paths must join the parent card so a trashed card stops contributing.
 * - `hasanat_batches.remaining` is a **DB-maintained projection** of live distributions
 *   (`hasanat_recalc_batch_remaining()` triggers, migration 0225). Never write it from the client.
 *
 * Foreign keys to people use the composite `(workspace_subdomain, <person>_id)` form so tenant
 * isolation holds at the constraint level. The `(workspace_subdomain, id)` referenced pairs are
 * unique, and the student/faculty `ON DELETE SET NULL` action is applied in the database as the
 * PostgreSQL 15+ column-list form (`SET NULL (recipient_student_id)`); Drizzle cannot express the
 * column list, so migration 0226 owns that DDL and this declaration stays action-compatible.
 */

export const hasanatDenoms = pgTable(
  "hasanat_denoms",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    points: integer("points").notNull().default(0),
    color: varchar("color", { length: 64 }).notNull().default("emerald"),
    description: text("description").notNull().default(""),
    icon: varchar("icon", { length: 64 }).notNull().default("Star"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("hasanat_denoms_workspace_active_idx").on(table.workspaceSubdomain, table.active),
    check("hasanat_denoms_points_chk", sql`${table.points} >= 0`),
  ],
);

export const hasanatBatches = pgTable(
  "hasanat_batches",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    denominationId: text("denomination_id").notNull(),
    denominationName: varchar("denomination_name", { length: 120 }).notNull().default(""),
    quantity: integer("quantity").notNull().default(0),
    /** Maintained by `hasanat_recalc_batch_remaining()` — a projection, never a client value. */
    remaining: integer("remaining").notNull().default(0),
    addedDate: date("added_date", { mode: "string" }).notNull(),
    addedByUserId: text("added_by_user_id"),
    addedBy: varchar("added_by", { length: 120 }),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.denominationId],
      foreignColumns: [hasanatDenoms.workspaceSubdomain, hasanatDenoms.id],
    }).onDelete("cascade"),
    index("hasanat_batches_workspace_denom_idx").on(table.workspaceSubdomain, table.denominationId),
    index("hasanat_batches_workspace_added_date_idx").on(table.workspaceSubdomain, table.addedDate),
    index("hasanat_batches_workspace_added_by_idx").on(
      table.workspaceSubdomain,
      table.addedByUserId,
    ),
    check(
      "hasanat_batches_remaining_chk",
      sql`${table.remaining} >= 0 and ${table.remaining} <= ${table.quantity}`,
    ),
    check("hasanat_batches_quantity_chk", sql`${table.quantity} > 0`),
  ],
);

export const hasanatDistributions = pgTable(
  "hasanat_distributions",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    batchId: text("batch_id").notNull(),
    denominationId: text("denomination_id").notNull(),
    denominationName: varchar("denomination_name", { length: 120 }).notNull().default(""),
    recipientType: varchar("recipient_type", { length: 20 }).notNull().default("student"),
    recipientStudentId: varchar("recipient_student_id", { length: 64 }),
    recipientFacultyId: varchar("recipient_faculty_id", { length: 64 }),
    recipientName: varchar("recipient_name", { length: 255 }).notNull().default(""),
    recipientClass: varchar("recipient_class", { length: 120 }).notNull().default(""),
    /** `session_classes.id` at issue time; `recipientClass` stays as the display snapshot. */
    classId: text("class_id"),
    /**
     * `sessions.id` at issue time — stamped on write from `classId`. Required for per-session
     * point aggregation; rows that cannot be attributed stay NULL and are reported as unattributed.
     */
    sessionId: text("session_id"),
    quantity: integer("quantity").notNull().default(1),
    reason: text("reason").notNull().default(""),
    issuedDate: date("issued_date", { mode: "string" }).notNull(),
    issuedByUserId: text("issued_by_user_id"),
    issuedBy: varchar("issued_by", { length: 120 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.batchId],
      foreignColumns: [hasanatBatches.workspaceSubdomain, hasanatBatches.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.denominationId],
      foreignColumns: [hasanatDenoms.workspaceSubdomain, hasanatDenoms.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.recipientStudentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.recipientFacultyId],
      foreignColumns: [faculty.workspaceSubdomain, faculty.id],
    }).onDelete("set null"),
    index("hasanat_dist_workspace_faculty_idx").on(
      table.workspaceSubdomain,
      table.recipientFacultyId,
    ),
    index("hasanat_dist_workspace_batch_idx").on(table.workspaceSubdomain, table.batchId),
    foreignKey({
      name: "hasanat_distributions_class_fk",
      columns: [table.workspaceSubdomain, table.classId],
      foreignColumns: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }).onDelete("restrict"),
    index("hasanat_distributions_class_idx").on(table.workspaceSubdomain, table.classId),
    foreignKey({
      name: "hasanat_distributions_session_fk",
      columns: [table.workspaceSubdomain, table.sessionId],
      foreignColumns: [sessions.workspaceSubdomain, sessions.id],
    }).onDelete("restrict"),
    index("hasanat_dist_ws_session_student_idx").on(
      table.workspaceSubdomain,
      table.sessionId,
      table.recipientStudentId,
    ),
    /** Balance / history aggregation: tenant + student + session + status in one descent. */
    index("hasanat_dist_ws_student_session_status_idx").on(
      table.workspaceSubdomain,
      table.recipientStudentId,
      table.sessionId,
      table.status,
    ),
    index("hasanat_dist_ws_student_issued_active_idx")
      .on(table.workspaceSubdomain, table.recipientStudentId, table.issuedDate.desc())
      .where(sql`${table.deletedAt} is null`),
    index("hasanat_dist_workspace_denom_idx").on(table.workspaceSubdomain, table.denominationId),
    index("hasanat_dist_workspace_issued_date_idx").on(table.workspaceSubdomain, table.issuedDate),
    index("hasanat_dist_workspace_issued_by_idx").on(
      table.workspaceSubdomain,
      table.issuedByUserId,
    ),
    /** Default Work list sort (`ORDER BY updated_at DESC`). */
    index("hasanat_dist_ws_updated_active_idx")
      .on(table.workspaceSubdomain, table.updatedAt.desc())
      .where(sql`${table.deletedAt} is null`),
    /** Status-filtered Work list sort. */
    index("hasanat_dist_ws_status_updated_active_idx")
      .on(table.workspaceSubdomain, table.status, table.updatedAt.desc())
      .where(sql`${table.deletedAt} is null`),
    index("hasanat_dist_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("hasanat_dist_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    check("hasanat_dist_quantity_chk", sql`${table.quantity} > 0`),
    check("hasanat_dist_status_chk", sql`${table.status} in ('active', 'redeemed', 'returned')`),
    check("hasanat_dist_recipient_type_chk", sql`${table.recipientType} in ('student', 'faculty')`),
    check(
      "hasanat_dist_recipient_exclusive_chk",
      sql`${table.recipientStudentId} is null or ${table.recipientFacultyId} is null`,
    ),
  ],
);

export const hasanatRedemptions = pgTable(
  "hasanat_redemptions",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    distributionId: text("distribution_id").notNull(),
    /** `students.id` of the card recipient — the ledger's only student link. */
    studentId: varchar("student_id", { length: 64 }),
    studentName: varchar("student_name", { length: 255 }).notNull().default(""),
    reward: text("reward").notNull().default(""),
    pointsUsed: integer("points_used").notNull().default(0),
    date: date("date", { mode: "string" }).notNull(),
    approvedByUserId: text("approved_by_user_id"),
    approvedBy: varchar("approved_by", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.distributionId],
      foreignColumns: [hasanatDistributions.workspaceSubdomain, hasanatDistributions.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("restrict"),
    /** Ledger history for one card: `(tenant, card_id, created_at)`. */
    index("hasanat_redemp_ws_dist_created_idx").on(
      table.workspaceSubdomain,
      table.distributionId,
      table.createdAt.desc(),
    ),
    index("hasanat_redemp_workspace_date_idx").on(table.workspaceSubdomain, table.date),
    index("hasanat_redemp_workspace_approved_by_idx").on(
      table.workspaceSubdomain,
      table.approvedByUserId,
    ),
    check("hasanat_redemp_points_used_chk", sql`${table.pointsUsed} > 0`),
  ],
);

export const hasanatFieldConfigs = pgTable(
  "hasanat_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

export const hasanatModulePreferences = pgTable(
  "hasanat_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type HasanatDenomRow = typeof hasanatDenoms.$inferSelect;
export type InsertHasanatDenomRow = typeof hasanatDenoms.$inferInsert;
export type HasanatBatchRow = typeof hasanatBatches.$inferSelect;
export type InsertHasanatBatchRow = typeof hasanatBatches.$inferInsert;
export type HasanatDistributionRow = typeof hasanatDistributions.$inferSelect;
export type InsertHasanatDistributionRow = typeof hasanatDistributions.$inferInsert;
export type HasanatRedemptionRow = typeof hasanatRedemptions.$inferSelect;
export type InsertHasanatRedemptionRow = typeof hasanatRedemptions.$inferInsert;
export type HasanatFieldConfigsRow = typeof hasanatFieldConfigs.$inferSelect;
export type InsertHasanatFieldConfigsRow = typeof hasanatFieldConfigs.$inferInsert;
export type HasanatModulePreferencesRow = typeof hasanatModulePreferences.$inferSelect;
export type InsertHasanatModulePreferencesRow = typeof hasanatModulePreferences.$inferInsert;
