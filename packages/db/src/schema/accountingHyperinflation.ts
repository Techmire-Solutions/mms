import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  varchar,
  numeric,
  boolean,
  index,
  foreignKey,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";

/** IAS 29: whether the functional currency is hyperinflationary, and where the monetary gain/loss goes. */
export const accountingHyperinflationSettings = pgTable("accounting_hyperinflation_settings", {
  workspaceSubdomain: text("workspace_subdomain")
    .primaryKey()
    .references(() => workspaces.subdomain, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  netMonetaryAccountId: text("net_monetary_account_id"),
  appliesFrom: varchar("applies_from", { length: 10 }),
  indexName: text("index_name").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

/** General price index level per date (IAS 29.37). */
export const accountingPriceIndices = pgTable(
  "accounting_price_indices",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    indexDate: varchar("index_date", { length: 10 }).notNull(),
    value: numeric("value", { precision: 18, scale: 6 }).notNull(),
    source: text("source").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.indexDate] }),
    check("accounting_price_indices_positive", sql`${table.value} > 0`),
  ],
);

/** One posted IAS 29 restatement per workspace and date. */
export const accountingIas29Runs = pgTable(
  "accounting_ias29_runs",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    restatementDate: varchar("restatement_date", { length: 10 }).notNull(),
    closingIndex: numeric("closing_index", { precision: 18, scale: 6 }).notNull(),
    netMonetaryResult: numeric("net_monetary_result", { precision: 19, scale: 4 }).notNull(),
    entryId: text("entry_id"),
    reversalEntryId: text("reversal_entry_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    uniqueIndex("accounting_ias29_runs_date_uidx").on(
      table.workspaceSubdomain,
      table.restatementDate,
    ),
  ],
);

/** The per-account restatement figures a run posted. */
export const accountingIas29Lines = pgTable(
  "accounting_ias29_lines",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    accountId: text("account_id").notNull(),
    carrying: numeric("carrying", { precision: 19, scale: 4 }).notNull(),
    restated: numeric("restated", { precision: 19, scale: 4 }).notNull(),
    adjustment: numeric("adjustment", { precision: 19, scale: 4 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.runId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.runId],
      foreignColumns: [accountingIas29Runs.workspaceSubdomain, accountingIas29Runs.id],
    }).onDelete("cascade"),
    index("accounting_ias29_lines_run_idx").on(table.workspaceSubdomain, table.runId),
  ],
);
