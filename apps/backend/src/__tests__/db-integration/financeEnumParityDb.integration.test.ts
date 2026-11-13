import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant } from "../../db/tenant-context.js";
import {
  ACCOUNTING_ACCOUNT_TYPES,
  FISCAL_YEAR_STATUSES,
  INVOICE_STATUSES,
  JOURNAL_ENTRY_STATUSES,
  POSTING_PERIOD_STATUSES,
} from "@mms/shared";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const CHECK_CONSTRAINTS: Array<{
  table: string;
  constraint: string;
  values: readonly string[];
}> = [
  {
    table: "accounting_accounts",
    constraint: "accounting_accounts_type_chk",
    values: ACCOUNTING_ACCOUNT_TYPES,
  },
  {
    table: "accounting_entries",
    constraint: "accounting_entries_status_chk",
    values: JOURNAL_ENTRY_STATUSES,
  },
  {
    table: "accounting_fiscal_years",
    constraint: "accounting_fiscal_years_status_chk",
    values: FISCAL_YEAR_STATUSES,
  },
  {
    table: "accounting_posting_periods",
    constraint: "accounting_posting_periods_status_check",
    values: POSTING_PERIOD_STATUSES,
  },
  {
    table: "finance_invoices",
    constraint: "finance_invoices_status_chk",
    values: INVOICE_STATUSES,
  },
];

/** Extracts the quoted literals of a `... = ANY (ARRAY['a', 'b'])` check. */
function checkValues(definition: string): string[] {
  const values = [...definition.matchAll(/'([^']+)'::character varying/g)].map(
    (match) => match[1]!,
  );
  return [...new Set(values)].sort();
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
});

afterAll(async () => {
  await closeDatabase();
});

describe("DB constraints match the shared enums", () => {
  it("pins every finance/accounting status constraint to its shared set", async () => {
    const rows = await withGlobalTenant(async (tx) => {
      const result = await tx.execute(sql`
        SELECT conrelid::regclass::text AS table_name,
               conname AS constraint_name,
               pg_get_constraintdef(oid) AS definition
          FROM pg_constraint
         WHERE conname IN (
           'accounting_accounts_type_chk',
           'accounting_entries_status_chk',
           'accounting_fiscal_years_status_chk',
           'accounting_posting_periods_status_check',
           'finance_invoices_status_chk'
         )
      `);
      return result.rows as Array<{
        table_name: string;
        constraint_name: string;
        definition: string;
      }>;
    });

    for (const expected of CHECK_CONSTRAINTS) {
      const row = rows.find((candidate) => candidate.constraint_name === expected.constraint);
      expect(row, `${expected.constraint} must exist`).toBeDefined();
      expect(row!.table_name).toBe(expected.table);
      expect(checkValues(row!.definition)).toEqual([...expected.values].sort());
    }
  });

  it("keeps every 2-dp money column exact in integer cents", async () => {
    // A scale-2 column converted with `Number()` is exact while its cents fit in
    // 2^53 (≈ 9.0e15). precision-scale+2 ≤ 15 must hold or the DTO has to become
    // a decimal string before anyone widens the column.
    const rows = await withGlobalTenant(async (tx) => {
      const result = await tx.execute(sql`
        SELECT table_name, column_name, numeric_precision, numeric_scale
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND data_type = 'numeric'
           AND numeric_scale = 2
           AND table_name IN (
             'finance_invoices','finance_payments','finance_invoice_lines',
             'accounting_journal_lines','accounting_entries'
           )
      `);
      return result.rows as Array<{
        table_name: string;
        column_name: string;
        numeric_precision: number;
        numeric_scale: number;
      }>;
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const column of rows) {
      const integerDigits = column.numeric_precision - column.numeric_scale;
      expect(
        integerDigits + 2,
        `${column.table_name}.${column.column_name} (${column.numeric_precision},${column.numeric_scale}) exceeds exact cents`,
      ).toBeLessThanOrEqual(15);
    }
  });
});
