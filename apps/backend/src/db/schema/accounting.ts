import {
  date,
  pgTable,
  text,
  timestamp,
  index,
  boolean,
  primaryKey,
  varchar,
  numeric,
  foreignKey,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { desc, sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { fxLineColumns } from "./accountingFxColumns.js";
import { accountingAccounts } from "./accountingAccounts.js";

/**
 * Chart of accounts lives in `accountingAccounts.ts` (300-line ceiling); it is
 * re-exported here so every existing `./accounting.js` import keeps working.
 */
export {
  accountingAccounts,
  type AccountingAccountRow,
  type InsertAccountingAccountRow,
} from "./accountingAccounts.js";

export const accountingFiscalYears = pgTable(
  "accounting_fiscal_years",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }).notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("upcoming"),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    closedBy: text("closed_by"),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("accounting_fiscal_years_workspace_status_idx").on(
      table.workspaceSubdomain,
      table.status,
    ),
    index("accounting_fiscal_years_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
    index("accounting_fiscal_years_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("accounting_fiscal_years_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    /** Directory default ordering (`created_at DESC, id`) for the active list. */
    index("accounting_fiscal_years_workspace_created_active_idx")
      .on(table.workspaceSubdomain, sql`${table.createdAt} desc`, table.id)
      .where(sql`${table.deletedAt} is null`),
    /** Pinned to `@mms/shared` `FISCAL_YEAR_STATUSES` (0252 + parity test). */
    check(
      "accounting_fiscal_years_status_chk",
      sql`${table.status} IN ('active', 'closed', 'upcoming')`,
    ),
  ],
);

export const accountingPostingPeriods = pgTable(
  "accounting_posting_periods",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    fiscalYearId: text("fiscal_year_id").notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    /** Close attribution: a period lock with no record of who set it is not auditable. */
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    closedBy: text("closed_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.fiscalYearId],
      foreignColumns: [accountingFiscalYears.workspaceSubdomain, accountingFiscalYears.id],
    }).onDelete("cascade"),
    check("accounting_posting_periods_range_chk", sql`${table.startDate} <= ${table.endDate}`),
    /**
     * The period lock is `status = 'closed'` (0249 balance guard), so the column
     * cannot be free text. Pinned to `@mms/shared` `POSTING_PERIOD_STATUSES`.
     */
    check("accounting_posting_periods_status_check", sql`${table.status} IN ('open', 'closed')`),
    uniqueIndex("accounting_posting_periods_year_start_uidx").on(
      table.workspaceSubdomain,
      table.fiscalYearId,
      table.startDate,
    ),
    index("accounting_posting_periods_workspace_date_idx").on(
      table.workspaceSubdomain,
      table.startDate,
      table.endDate,
    ),
  ],
);

export const accountingEntries = pgTable(
  "accounting_entries",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    ref: varchar("ref", { length: 100 }).notNull().default(""),
    description: text("description").notNull().default(""),
    status: varchar("status", { length: 20 }).notNull().default("posted"),
    createdBy: varchar("created_by", { length: 120 }).notNull().default(""),
    fiscalYear: varchar("fiscal_year", { length: 64 }).notNull().default(""),
    fiscalYearId: text("fiscal_year_id"),
    sourceType: varchar("source_type", { length: 20 }),
    sourceId: varchar("source_id", { length: 64 }),
    transactionType: varchar("transaction_type", { length: 50 }),
    reversedRef: varchar("reversed_ref", { length: 100 }),
    simpleMode: boolean("simple_mode").notNull().default(false),
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("accounting_entries_workspace_date_idx").on(table.workspaceSubdomain, table.date),
    index("accounting_entries_workspace_status_idx").on(table.workspaceSubdomain, table.status),
    index("accounting_entries_workspace_fiscal_idx").on(table.workspaceSubdomain, table.fiscalYear),
    index("accounting_entries_workspace_fiscal_id_idx").on(
      table.workspaceSubdomain,
      table.fiscalYearId,
    ),
    uniqueIndex("accounting_entries_workspace_source_uidx")
      .on(table.workspaceSubdomain, table.sourceType, table.sourceId)
      .where(
        sql`${table.sourceType} is not null and ${table.sourceId} is not null and ${table.deletedAt} is null`,
      ),
    uniqueIndex("accounting_entries_workspace_ref_active_uidx")
      .on(table.workspaceSubdomain, table.ref)
      .where(sql`${table.deletedAt} is null and ${table.ref} is not null and ${table.ref} <> ''`),
    foreignKey({
      columns: [table.workspaceSubdomain, table.fiscalYearId],
      foreignColumns: [accountingFiscalYears.workspaceSubdomain, accountingFiscalYears.id],
    }),
    index("accounting_entries_workspace_deleted_idx").on(table.workspaceSubdomain, table.deletedAt),
    index("accounting_entries_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("accounting_entries_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    index("accounting_entries_workspace_fiscal_date_active_idx")
      .on(table.workspaceSubdomain, table.fiscalYear, desc(table.date))
      .where(sql`${table.deletedAt} is null`),
    /**
     * Default journal directory ordering (`created_at DESC, id` — see
     * `buildEntryOrderBy`). Without it the list sorts the whole tenant on every
     * page request; the `date`/`status` indexes cannot serve that ORDER BY.
     */
    index("accounting_entries_workspace_created_active_idx")
      .on(table.workspaceSubdomain, desc(table.createdAt), table.id)
      .where(sql`${table.deletedAt} is null`),
    /** Status filter combined with the date range the Journal tab exposes. */
    index("accounting_entries_workspace_status_date_active_idx")
      .on(table.workspaceSubdomain, table.status, desc(table.date))
      .where(sql`${table.deletedAt} is null`),
    /** Journal date range without a status filter (`buildEntryListConditions`). */
    index("accounting_entries_workspace_date_active_idx")
      .on(table.workspaceSubdomain, table.date, table.id)
      .where(sql`${table.deletedAt} is null`),
    /**
     * Voucher allocation probes `ref = ANY(candidates)` with no `deleted_at`
     * predicate, so the partial unique ref index cannot serve it — without this
     * every journal save scanned the tenant's entries.
     */
    index("accounting_entries_workspace_ref_idx").on(table.workspaceSubdomain, table.ref),
    check("accounting_entries_status_chk", sql`${table.status} IN ('posted', 'draft')`),
    /**
     * Legal source types are single-sourced in
     * `packages/shared/src/finance/accountingLedgerInvariants.ts`; a shared test
     * pins this list to it (the 0243 taxonomy pattern).
     */
    check(
      "accounting_entries_source_type_chk",
      sql`${table.sourceType} IS NULL OR ${table.sourceType} IN ('manual', 'invoice', 'payment', 'closing', 'reversal', 'opening', 'obligation', 'fx_reval', 'fx_reval_reversal', 'ias29_restate', 'ias29_reversal', 'hedge_val', 'hedge_val_rev', 'hedge_settle', 'hedge_reclass')`,
    ),
  ],
);

export const accountingJournalLines = pgTable(
  "accounting_journal_lines",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    entryId: text("entry_id").notNull(),
    accountId: text("account_id").notNull(),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
    ...fxLineColumns,
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.entryId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.entryId],
      foreignColumns: [accountingEntries.workspaceSubdomain, accountingEntries.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.accountId],
      foreignColumns: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
    }),
    index("accounting_lines_workspace_entry_idx").on(table.workspaceSubdomain, table.entryId),
    index("accounting_lines_workspace_account_idx").on(table.workspaceSubdomain, table.accountId),
    // `accounting_journal_lines_covering_idx` — (workspace_subdomain, account_id) INCLUDE
    // (debit, credit), for the trial-balance / general-ledger aggregates. Not declared
    // here on purpose: drizzle-orm 0.45 cannot express INCLUDE, so the model would
    // claim a shape it cannot build. It is created by migration 0248 (a plain build is
    // fine — accounting_journal_lines is not in the migration-index ratchet's large
    // tables) and, being absent from the snapshot, is never dropped by a later generate.
    /**
     * IAS 21 amounts need the same sign/single-side rule the functional
     * `debit`/`credit` pair has had since 0092. The checks are NOT VALID on
     * existing rows (they may predate the rule) but do apply to every new write.
     */
    check(
      "accounting_journal_lines_txn_sign_chk",
      sql`coalesce(${table.txnDebit}, 0) >= 0 AND coalesce(${table.txnCredit}, 0) >= 0`,
    ),
    check(
      "accounting_journal_lines_func_sign_chk",
      sql`coalesce(${table.funcDebit}, 0) >= 0 AND coalesce(${table.funcCredit}, 0) >= 0`,
    ),
    /** 0092's rules for the functional pair; NOT VALID on legacy rows only. */
    check("accounting_journal_lines_nonneg_chk", sql`${table.debit} >= 0 AND ${table.credit} >= 0`),
    check(
      "accounting_journal_lines_single_side_chk",
      sql`${table.debit} = 0 OR ${table.credit} = 0`,
    ),
    /** The ledger mirrors the functional pair (0249); a writer cannot make them disagree. */
    check(
      "accounting_journal_lines_func_debit_mirror_chk",
      sql`${table.funcDebit} IS NULL OR ${table.funcDebit} = ${table.debit}`,
    ),
    check(
      "accounting_journal_lines_func_credit_mirror_chk",
      sql`${table.funcCredit} IS NULL OR ${table.funcCredit} = ${table.credit}`,
    ),
    /**
     * IAS 21 transaction rate. Both rate tables require a positive rate
     * (`accounting_exchange_rates_positive`, `fx_reference_rates_positive`); a
     * line could previously store zero or a negative multiplier.
     */
    check(
      "accounting_journal_lines_rate_positive_chk",
      sql`${table.exchangeRate} IS NULL OR ${table.exchangeRate} > 0`,
    ),
  ],
);

/* ========================================================================= */
/*                         ROW INFER TYPES                                   */
/* ========================================================================= */

export type AccountingFiscalYearRow = typeof accountingFiscalYears.$inferSelect;
export type InsertAccountingFiscalYearRow = typeof accountingFiscalYears.$inferInsert;
export type AccountingPostingPeriodRow = typeof accountingPostingPeriods.$inferSelect;
export type AccountingEntryRow = typeof accountingEntries.$inferSelect;
export type InsertAccountingEntryRow = typeof accountingEntries.$inferInsert;
export type AccountingJournalLineRow = typeof accountingJournalLines.$inferSelect;
export type InsertAccountingJournalLineRow = typeof accountingJournalLines.$inferInsert;
