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
import {
  accountingAccounts,
  accountingFiscalYears,
  accountingEntries,
  accountingJournalLines,
} from "./accounting.js";

export const accountingPostingRules = pgTable(
  "accounting_posting_rules",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    arAccountId: text("ar_account_id"),
    cashAccountId: text("cash_account_id"),
    incomeAccountId: text("income_account_id"),
    discountAccountId: text("discount_account_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.arAccountId],
      foreignColumns: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
    }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.cashAccountId],
      foreignColumns: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
    }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.incomeAccountId],
      foreignColumns: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
    }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.discountAccountId],
      foreignColumns: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
    }),
  ],
);

export const accountingOpeningBalances = pgTable(
  "accounting_opening_balances",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    fiscalYearId: text("fiscal_year_id").notNull(),
    accountId: text("account_id").notNull(),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.fiscalYearId, table.id] }),
    uniqueIndex("accounting_opening_balances_year_account_uidx").on(
      table.workspaceSubdomain,
      table.fiscalYearId,
      table.accountId,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.fiscalYearId],
      foreignColumns: [accountingFiscalYears.workspaceSubdomain, accountingFiscalYears.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.accountId],
      foreignColumns: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
    }),
    index("accounting_opening_balances_workspace_year_idx").on(
      table.workspaceSubdomain,
      table.fiscalYearId,
    ),
  ],
);

export const accountingBankStatements = pgTable(
  "accounting_bank_statements",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    periodStart: varchar("period_start", { length: 10 }).notNull(),
    periodEnd: varchar("period_end", { length: 10 }).notNull(),
    openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    closingBalance: numeric("closing_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.accountId],
      foreignColumns: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
    }),
    index("accounting_bank_statements_workspace_account_idx").on(
      table.workspaceSubdomain,
      table.accountId,
    ),
  ],
);

export const accountingBankStatementLines = pgTable(
  "accounting_bank_statement_lines",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    statementId: text("statement_id").notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    description: text("description").notNull().default(""),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.statementId, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.statementId],
      foreignColumns: [accountingBankStatements.workspaceSubdomain, accountingBankStatements.id],
    }).onDelete("cascade"),
    index("accounting_bank_statement_lines_workspace_statement_idx").on(
      table.workspaceSubdomain,
      table.statementId,
    ),
  ],
);

export const accountingBankReconciliations = pgTable(
  "accounting_bank_reconciliations",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    statementLineId: text("statement_line_id").notNull(),
    journalEntryId: text("journal_entry_id").notNull(),
    journalLineId: text("journal_line_id").notNull(),
    matchedAt: timestamp("matched_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.statementLineId] }),
    uniqueIndex("accounting_bank_reconciliations_journal_line_uidx").on(
      table.workspaceSubdomain,
      table.journalEntryId,
      table.journalLineId,
    ),
    foreignKey({
      columns: [table.workspaceSubdomain, table.journalEntryId],
      foreignColumns: [accountingEntries.workspaceSubdomain, accountingEntries.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.journalEntryId, table.journalLineId],
      foreignColumns: [
        accountingJournalLines.workspaceSubdomain,
        accountingJournalLines.entryId,
        accountingJournalLines.id,
      ],
    }).onDelete("cascade"),
  ],
);

export type AccountingPostingRulesRow = typeof accountingPostingRules.$inferSelect;
export type InsertAccountingPostingRulesRow = typeof accountingPostingRules.$inferInsert;
export type AccountingOpeningBalanceRow = typeof accountingOpeningBalances.$inferSelect;
export type InsertAccountingOpeningBalanceRow = typeof accountingOpeningBalances.$inferInsert;
export type AccountingBankStatementRow = typeof accountingBankStatements.$inferSelect;
export type InsertAccountingBankStatementRow = typeof accountingBankStatements.$inferInsert;
export type AccountingBankStatementLineRow = typeof accountingBankStatementLines.$inferSelect;
export type InsertAccountingBankStatementLineRow = typeof accountingBankStatementLines.$inferInsert;
export type AccountingBankReconciliationRow = typeof accountingBankReconciliations.$inferSelect;
export type InsertAccountingBankReconciliationRow =
  typeof accountingBankReconciliations.$inferInsert;
