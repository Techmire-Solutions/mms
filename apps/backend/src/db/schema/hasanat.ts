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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";
import { faculty } from "./faculty.js";
import { sessionClasses } from "./sessions.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

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
    index("hasanat_dist_workspace_student_idx").on(
      table.workspaceSubdomain,
      table.recipientStudentId,
    ),
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
    index("hasanat_dist_workspace_denom_idx").on(table.workspaceSubdomain, table.denominationId),
    index("hasanat_dist_workspace_issued_date_idx").on(table.workspaceSubdomain, table.issuedDate),
    index("hasanat_dist_workspace_status_idx").on(table.workspaceSubdomain, table.status),
    index("hasanat_dist_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("hasanat_dist_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("hasanat_dist_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
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
    index("hasanat_redemp_workspace_dist_idx").on(table.workspaceSubdomain, table.distributionId),
    index("hasanat_redemp_workspace_date_idx").on(table.workspaceSubdomain, table.date),
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
