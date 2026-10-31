import {
  pgTable,
  text,
  timestamp,
  index,
  boolean,
  primaryKey,
  varchar,
  numeric,
  foreignKey,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { softDeleteColumns } from "./softDeleteSchema.js";

export const obligationTypes = pgTable(
  "obligation_types",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    quantityBased: boolean("quantity_based").notNull().default(false),
    designatedFor: varchar("designated_for", { length: 20 }).notNull().default("Both"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("obligation_types_workspace_name_idx").on(table.workspaceSubdomain, table.name),
  ],
);

export const mujtahids = pgTable(
  "mujtahids",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("mujtahids_workspace_name_idx").on(table.workspaceSubdomain, table.name),
  ],
);

export const mujtahidReps = pgTable(
  "mujtahid_reps",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    mujtahidId: text("mujtahid_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.mujtahidId],
      foreignColumns: [mujtahids.workspaceSubdomain, mujtahids.id],
    }).onDelete("cascade"),
    index("mujtahid_reps_workspace_mujtahid_idx").on(table.workspaceSubdomain, table.mujtahidId),
  ],
);

export const wakalaTypes = pgTable(
  "wakala_types",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    mujtahidRepresentativeId: text("mujtahid_representative_id").notNull(),
    obligationTypeId: text("obligation_type_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("wakala_types_workspace_rep_idx").on(
      table.workspaceSubdomain,
      table.mujtahidRepresentativeId,
    ),
    index("wakala_types_workspace_type_idx").on(table.workspaceSubdomain, table.obligationTypeId),
  ],
);

export const obligationDistributions = pgTable(
  "obligation_distributions",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull().default("0"),
    wakalaTypeId: text("wakala_type_id").notNull(),
    type: varchar("type", { length: 30 }).notNull(),
    accountId: text("account_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.wakalaTypeId],
      foreignColumns: [wakalaTypes.workspaceSubdomain, wakalaTypes.id],
    }).onDelete("cascade"),
    index("obligation_distributions_workspace_wakala_idx").on(
      table.workspaceSubdomain,
      table.wakalaTypeId,
    ),
  ],
);

export const obligationCollections = pgTable(
  "obligation_collections",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    receiptNo: varchar("receipt_no", { length: 100 }).notNull(),
    receivedDate: varchar("received_date", { length: 30 }).notNull(),
    senderId: varchar("sender_id", { length: 64 }).notNull(),
    referenceId: varchar("reference_id", { length: 120 }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    currencyId: varchar("currency_id", { length: 30 }).notNull(),
    paymentMode: varchar("payment_mode", { length: 30 }).notNull(),
    obligationTypeId: text("obligation_type_id").notNull(),
    mujtahidRepresentativeId: text("mujtahid_representative_id").notNull(),
    receivedBy: varchar("received_by", { length: 255 }).notNull(),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("obligation_collections_workspace_receipt_idx").on(
      table.workspaceSubdomain,
      table.receiptNo,
    ),
    index("obligation_collections_workspace_date_idx").on(
      table.workspaceSubdomain,
      table.receivedDate,
    ),
    index("obligation_collections_workspace_sender_idx").on(
      table.workspaceSubdomain,
      table.senderId,
    ),
    index("obligation_collections_workspace_type_idx").on(
      table.workspaceSubdomain,
      table.obligationTypeId,
    ),
    index("obligation_collections_workspace_rep_idx").on(
      table.workspaceSubdomain,
      table.mujtahidRepresentativeId,
    ),
    index("obligation_collections_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
    index("obligation_collections_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("obligation_collections_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

/** Per-user Obligations Work column layout (was document-store `obligations_user_column_preferences`). */
/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type ObligationTypeRow = typeof obligationTypes.$inferSelect;
export type InsertObligationTypeRow = typeof obligationTypes.$inferInsert;
export type MujtahidRow = typeof mujtahids.$inferSelect;
export type InsertMujtahidRow = typeof mujtahids.$inferInsert;
export type MujtahidRepRow = typeof mujtahidReps.$inferSelect;
export type InsertMujtahidRepRow = typeof mujtahidReps.$inferInsert;
export type WakalaTypeRow = typeof wakalaTypes.$inferSelect;
export type InsertWakalaTypeRow = typeof wakalaTypes.$inferInsert;
export type ObligationDistributionRow = typeof obligationDistributions.$inferSelect;
export type InsertObligationDistributionRow = typeof obligationDistributions.$inferInsert;
export type ObligationCollectionRow = typeof obligationCollections.$inferSelect;
export type InsertObligationCollectionRow = typeof obligationCollections.$inferInsert;

export const obligationModulePreferences = pgTable(
  "obligation_module_preferences",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

export type ObligationModulePreferencesRow = typeof obligationModulePreferences.$inferSelect;
export type InsertObligationModulePreferencesRow = typeof obligationModulePreferences.$inferInsert;
