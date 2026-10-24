import {
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./platform.js";

/**
 * Per-workspace journal voucher numbering format (the shared
 * `SequenceNumberingConfig` shape). Absent row = `DEFAULT_VOUCHER_NUMBERING`.
 */
export const accountingVoucherNumbering = pgTable(
  "accounting_voucher_numbering",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    autoGenerate: boolean("auto_generate").notNull().default(true),
    prefix: varchar("prefix", { length: 10 }).notNull().default("JE"),
    delimiter: varchar("delimiter", { length: 1 }).notNull().default("-"),
    yearFormat: varchar("year_format", { length: 4 }).notNull().default("NONE"),
    sequenceDigits: integer("sequence_digits").notNull().default(4),
    startingSequence: integer("starting_sequence").notNull().default(1),
    rolloverPolicy: varchar("rollover_policy", { length: 16 }).notNull().default("never"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain] }),
    check(
      "accounting_voucher_numbering_prefix_check",
      sql`${table.prefix} ~ '^[A-Za-z0-9]{0,10}$'`,
    ),
    check(
      "accounting_voucher_numbering_delimiter_check",
      sql`${table.delimiter} IN ('', '-', '/', '.')`,
    ),
    check(
      "accounting_voucher_numbering_year_format_check",
      sql`${table.yearFormat} IN ('YYYY', 'YY', 'NONE')`,
    ),
    check(
      "accounting_voucher_numbering_digits_check",
      sql`${table.sequenceDigits} BETWEEN 2 AND 8`,
    ),
    check(
      "accounting_voucher_numbering_start_check",
      sql`${table.startingSequence} BETWEEN 1 AND 99999999`,
    ),
    check(
      "accounting_voucher_numbering_rollover_check",
      sql`${table.rolloverPolicy} IN ('annual_calendar', 'annual_fiscal', 'never')`,
    ),
    check(
      "accounting_voucher_numbering_rollover_year_check",
      sql`${table.rolloverPolicy} = 'never' OR ${table.yearFormat} <> 'NONE'`,
    ),
  ],
);

/**
 * Last issued voucher sequence per (format, period). `period_year = 0` is the
 * never-resetting bucket. Allocation is an upsert on this row, so concurrent
 * writers serialize on its row lock until their transaction ends.
 */
export const accountingVoucherCounters = pgTable(
  "accounting_voucher_counters",
  {
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    formatKey: varchar("format_key", { length: 24 }).notNull(),
    periodYear: integer("period_year").notNull(),
    lastValue: integer("last_value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.formatKey, table.periodYear] }),
    check("accounting_voucher_counters_last_value_check", sql`${table.lastValue} >= 0`),
  ],
);

export type AccountingVoucherNumberingRow = typeof accountingVoucherNumbering.$inferSelect;
export type InsertAccountingVoucherNumberingRow = typeof accountingVoucherNumbering.$inferInsert;
export type AccountingVoucherCounterRow = typeof accountingVoucherCounters.$inferSelect;
export type InsertAccountingVoucherCounterRow = typeof accountingVoucherCounters.$inferInsert;
