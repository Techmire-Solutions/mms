/**
 * Obligations catalogue tables: obligation types, mujtahids and their representatives, wakala
 * types, and the per-wakala distribution rules that decide how a receipt is posted.
 *
 * Split out of `obligations.ts` to keep both files under the 300-line ceiling; the collections
 * table (which references every catalogue row) lives in `obligations.ts`, which re-exports this
 * half so `schema.ts` and the relations keep importing one module.
 */
import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
  boolean,
  primaryKey,
  varchar,
  numeric,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { accountingAccounts } from "./accountingAccounts.js";

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
    // Mirrors obligation_types_designated_for_chk (0258). The shared DTO caps this at the same
    // four values, but the column itself accepted any varchar(20) — so a repository write, a data
    // migration or a restored backup could carry a value the API would have rejected.
    check(
      "obligation_types_designated_for_chk",
      sql`${table.designatedFor} = ANY (ARRAY['Syed'::character varying, 'Non-Syed'::character varying, 'Both'::character varying, 'None'::character varying])`,
    ),
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
    // Both edges existed in the database since 0068 but were absent from the model (and the
    // snapshot), so `drizzle-kit push` would have dropped them. Constraint names match 0068.
    foreignKey({
      columns: [table.workspaceSubdomain, table.obligationTypeId],
      foreignColumns: [obligationTypes.workspaceSubdomain, obligationTypes.id],
      name: "wakala_types_obligation_type_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.mujtahidRepresentativeId],
      foreignColumns: [mujtahidReps.workspaceSubdomain, mujtahidReps.id],
      name: "wakala_types_rep_fk",
    }).onDelete("cascade"),
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
    /**
     * A distribution's account is what the receipt posts against. It had no reference at all
     * (0198 added the column bare), so a stale id was only discovered at posting time — where it
     * makes the whole receipt unpostable (`buildObligationPostingLines` returns null).
     */
    foreignKey({
      columns: [table.workspaceSubdomain, table.accountId],
      foreignColumns: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
      name: "obligation_distributions_account_fk",
    }).onDelete("restrict"),
    index("obligation_distributions_workspace_wakala_idx").on(
      table.workspaceSubdomain,
      table.wakalaTypeId,
    ),
    // A distribution name is unique inside its wakala (created concurrently by 0258's out-of-band
    // index file: `obligation_distributions` is in check:migration-indexes' LARGE_TABLES).
    uniqueIndex("obligation_distributions_workspace_wakala_name_uidx").on(
      table.workspaceSubdomain,
      table.wakalaTypeId,
      table.name,
    ),
    // numeric(5,2) accepted 999.99 while the DTO caps at 100, so the DB took rows the API rejects.
    check(
      "obligation_distributions_percentage_chk",
      sql`${table.percentage} >= 0 AND ${table.percentage} <= 100`,
    ),
    check(
      "obligation_distributions_type_chk",
      sql`${table.type} = ANY (ARRAY['Income'::character varying, 'Liability'::character varying])`,
    ),
  ],
);
