import {
  date,
  pgTable,
  text,
  timestamp,
  index,
  boolean,
  jsonb,
  primaryKey,
  varchar,
  numeric,
  foreignKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { desc, sql } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { softDeleteColumns } from "./softDeleteSchema.js";
import { fxAccountColumns, fxLineColumns } from "./accountingFxColumns.js";

export const accountingAccounts = pgTable(
  "accounting_accounts",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    subtype: varchar("subtype", { length: 100 }).notNull().default(""),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    ...fxAccountColumns,
    ...softDeleteColumns,
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("accounting_accounts_workspace_code_idx").on(table.workspaceSubdomain, table.code),
    index("accounting_accounts_workspace_type_idx").on(table.workspaceSubdomain, table.type),
    index("accounting_accounts_workspace_deleted_idx").on(
      table.workspaceSubdomain,
      table.deletedAt,
    ),
    index("accounting_accounts_workspace_active_idx")
      .on(table.workspaceSubdomain)
      .where(sql`${table.deletedAt} is null`),
    index("accounting_accounts_workspace_deleted_records_idx")
      .on(table.workspaceSubdomain, table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
  ],
);

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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.fiscalYearId],
      foreignColumns: [accountingFiscalYears.workspaceSubdomain, accountingFiscalYears.id],
    }).onDelete("cascade"),
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
  ],
);

export const accountingEntryTags = pgTable(
  "accounting_entry_tags",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    entryId: text("entry_id").notNull(),
    tag: varchar("tag", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.entryId, table.tag] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.entryId],
      foreignColumns: [accountingEntries.workspaceSubdomain, accountingEntries.id],
    }).onDelete("cascade"),
    index("accounting_entry_tags_workspace_entry_idx").on(table.workspaceSubdomain, table.entryId),
  ],
);

export const accountingEntryAttachments = pgTable(
  "accounting_entry_attachments",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    entryId: text("entry_id").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.entryId, table.url] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.entryId],
      foreignColumns: [accountingEntries.workspaceSubdomain, accountingEntries.id],
    }).onDelete("cascade"),
    index("accounting_entry_attachments_workspace_entry_idx").on(
      table.workspaceSubdomain,
      table.entryId,
    ),
  ],
);

export const accountingFieldConfigs = pgTable(
  "accounting_field_configs",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
);

export const accountingModulePreferences = pgTable(
  "accounting_module_preferences",
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

export type AccountingAccountRow = typeof accountingAccounts.$inferSelect;
export type InsertAccountingAccountRow = typeof accountingAccounts.$inferInsert;
export type AccountingFiscalYearRow = typeof accountingFiscalYears.$inferSelect;
export type InsertAccountingFiscalYearRow = typeof accountingFiscalYears.$inferInsert;
export type AccountingPostingPeriodRow = typeof accountingPostingPeriods.$inferSelect;
export type AccountingEntryRow = typeof accountingEntries.$inferSelect;
export type InsertAccountingEntryRow = typeof accountingEntries.$inferInsert;
export type AccountingJournalLineRow = typeof accountingJournalLines.$inferSelect;
export type InsertAccountingJournalLineRow = typeof accountingJournalLines.$inferInsert;
export type AccountingEntryTagRow = typeof accountingEntryTags.$inferSelect;
export type InsertAccountingEntryTagRow = typeof accountingEntryTags.$inferInsert;
export type AccountingEntryAttachmentRow = typeof accountingEntryAttachments.$inferSelect;
export type InsertAccountingEntryAttachmentRow = typeof accountingEntryAttachments.$inferInsert;
export type AccountingFieldConfigsRow = typeof accountingFieldConfigs.$inferSelect;
export type InsertAccountingFieldConfigsRow = typeof accountingFieldConfigs.$inferInsert;
export type AccountingModulePreferencesRow = typeof accountingModulePreferences.$inferSelect;
export type InsertAccountingModulePreferencesRow = typeof accountingModulePreferences.$inferInsert;
