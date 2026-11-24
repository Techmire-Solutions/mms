import {
  pgTable,
  text,
  timestamp,
  index,
  primaryKey,
  varchar,
  numeric,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import { workspaces } from "./platform.js";

/** One posted IAS 21 period-end revaluation per workspace and date. */
export const accountingFxRevaluationRuns = pgTable(
  "accounting_fx_revaluation_runs",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    revaluationDate: varchar("revaluation_date", { length: 10 }).notNull(),
    functionalCurrency: varchar("functional_currency", { length: 3 }).notNull(),
    totalUnrealized: numeric("total_unrealized", { precision: 19, scale: 4 }).notNull(),
    entryId: text("entry_id"),
    reversalEntryId: text("reversal_entry_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    uniqueIndex("accounting_fx_revaluation_runs_date_uidx").on(
      table.workspaceSubdomain,
      table.revaluationDate,
    ),
  ],
);

/** The per account × currency figures a revaluation run posted. */
export const accountingFxRevaluationLines = pgTable(
  "accounting_fx_revaluation_lines",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    accountId: text("account_id").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    openTxn: numeric("open_txn", { precision: 19, scale: 4 }).notNull(),
    closingRate: numeric("closing_rate", { precision: 20, scale: 10 }).notNull(),
    carryingFunc: numeric("carrying_func", { precision: 19, scale: 4 }).notNull(),
    revaluedFunc: numeric("revalued_func", { precision: 19, scale: 4 }).notNull(),
    unrealized: numeric("unrealized", { precision: 19, scale: 4 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.runId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.runId],
      foreignColumns: [
        accountingFxRevaluationRuns.workspaceSubdomain,
        accountingFxRevaluationRuns.id,
      ],
    }).onDelete("cascade"),
    index("accounting_fx_revaluation_lines_run_idx").on(table.workspaceSubdomain, table.runId),
  ],
);
