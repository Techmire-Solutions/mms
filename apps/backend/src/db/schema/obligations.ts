import {
  date,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
  integer,
  primaryKey,
  varchar,
  numeric,
  foreignKey,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { contacts } from "./contactCoreTables.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import {
  type obligationDistributions,
  mujtahidReps,
  type mujtahids,
  obligationTypes,
  type wakalaTypes,
} from "./obligationCatalogTables.js";

/**
 * The catalogue half (types, mujtahids, representatives, wakalas, distributions) lives in
 * `obligationCatalogTables.ts` so both files stay under the 300-line ceiling. Re-exported here so
 * `schema.ts` and the relations keep importing one module.
 */
export * from "./obligationCatalogTables.js";

export const obligationCollections = pgTable(
  "obligation_collections",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    receiptNo: varchar("receipt_no", { length: 100 }).notNull(),
    receivedDate: date("received_date", { mode: "string" }).notNull(),
    senderId: varchar("sender_id", { length: 64 }).notNull(),
    referenceId: varchar("reference_id", { length: 120 }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    currencyId: varchar("currency_id", { length: 30 }).notNull(),
    paymentMode: varchar("payment_mode", { length: 30 }).notNull(),
    obligationTypeId: text("obligation_type_id").notNull(),
    mujtahidRepresentativeId: text("mujtahid_representative_id").notNull(),
    receivedBy: varchar("received_by", { length: 255 }).notNull(),
    /**
     * OCC token (0258): a save carrying a stale version writes nothing and returns 409.
     * Without it, two editors both read the same amount and the second silently overwrote the
     * first — while each posted a ledger revision computed from its own stale `previous` row.
     */
    version: integer("version").notNull().default(1),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    /**
     * The donor link. `sender_id` is a contact id (the form binds a ContactPicker) but carried no
     * reference, so a purged contact left receipts pointing at nothing. RESTRICT is honest here:
     * `contacts` already forbids hard delete, so this only ever fires on a deliberate purge.
     */
    foreignKey({
      columns: [table.workspaceSubdomain, table.senderId],
      foreignColumns: [contacts.workspaceSubdomain, contacts.id],
      name: "obligation_collections_sender_fk",
    }).onDelete("restrict"),
    // Edges that existed in the database since 0068 but were absent from the model (F7).
    foreignKey({
      columns: [table.workspaceSubdomain, table.obligationTypeId],
      foreignColumns: [obligationTypes.workspaceSubdomain, obligationTypes.id],
      name: "obligation_collections_obligation_type_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.mujtahidRepresentativeId],
      foreignColumns: [mujtahidReps.workspaceSubdomain, mujtahidReps.id],
      name: "obligation_collections_rep_fk",
    }).onDelete("cascade"),
    check("obligation_collections_amount_chk", sql`${table.amount} >= 0`),
    check(
      "obligation_collections_payment_mode_chk",
      sql`${table.paymentMode} = ANY (ARRAY['Cash'::character varying, 'Online'::character varying])`,
    ),
    check("obligation_collections_version_chk", sql`${table.version} > 0`),
    /**
     * A receipt number is the human key on a printed voucher. The next number is derived in the
     * browser from the list it happens to hold, so two clients produced the same one; this unique
     * partial index (created concurrently) is the only thing that stops it.
     */
    uniqueIndex("obligation_collections_workspace_receipt_uidx")
      .on(table.workspaceSubdomain, table.receiptNo)
      .where(sql`${table.deletedAt} is null`),
    /**
     * Live since 0090 but declared nowhere — the drift is fixed here rather than by new DDL.
     * It supersedes the plain `(workspace_subdomain, received_date)` index that 0052 created,
     * which is dropped concurrently once this one is confirmed present.
     */
    index("obligation_collections_workspace_date_active_idx")
      .on(table.workspaceSubdomain, table.receivedDate.desc())
      .where(sql`${table.deletedAt} is null`),
    // Kept for per-contact lookups and, critically, for the referential probe behind the new
    // `obligation_collections_sender_fk` RESTRICT on a contact purge.
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
