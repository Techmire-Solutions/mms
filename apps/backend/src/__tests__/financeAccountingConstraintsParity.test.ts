import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_ACCOUNT_TYPES,
  FISCAL_YEAR_STATUSES,
  INVOICE_STATUSES,
  JOURNAL_ENTRY_LIFECYCLE,
  JOURNAL_ENTRY_STATUSES,
  JOURNAL_SOURCE_TYPES,
  POSTING_PERIOD_STATUSES,
} from "@mms/shared";

/**
 * Pins the database CHECK constraints introduced by 0248 to the shared arrays.
 * Lives in the backend because only this package can read migration files; the
 * shared package stays pure.
 */
const migrationDir = path.resolve(import.meta.dirname, "../db/migrations_drizzle");

describe("finance & accounting constraints ↔ shared enums", () => {
  const sql = readFileSync(
    path.join(migrationDir, "0248_finance_accounting_integrity.sql"),
    "utf-8",
  );

  it("accepts every journal source type the app can write", () => {
    // A value missing here would make a real posting path fail on a CHECK the
    // shared list says is legal.
    for (const value of JOURNAL_SOURCE_TYPES) expect(sql).toContain(`'${value}'`);
  });

  it("accepts every stored journal status the app can write", () => {
    // `accounting_entries_status_chk` installs in 0248 and is validated in 0252.
    for (const value of JOURNAL_ENTRY_STATUSES) expect(sql).toContain(`'${value}'`);
    const validateSql = readFileSync(
      path.join(migrationDir, "0252_finance_enum_checks.sql"),
      "utf-8",
    );
    expect(validateSql).toContain("accounting_entries_status_chk");
    for (const value of JOURNAL_ENTRY_STATUSES) expect(validateSql).toContain(`'${value}'`);
  });

  it("keeps the derived journal lifecycle states out of the database vocabulary", () => {
    // "reversed" is computed from a linked reversal entry; storing it would break
    // every posting/report query that filters status = 'posted'.
    const derivedOnly = JOURNAL_ENTRY_LIFECYCLE.filter(
      (state) => !(JOURNAL_ENTRY_STATUSES as readonly string[]).includes(state),
    );
    expect(derivedOnly).toEqual(["reversed"]);
    for (const state of derivedOnly) {
      expect(sql).not.toContain(`'${state}'`);
      const validateSql = readFileSync(
        path.join(migrationDir, "0252_finance_enum_checks.sql"),
        "utf-8",
      );
      expect(validateSql).not.toContain(`'${state}'`);
    }
  });

  it("accepts every invoice status the app can write", () => {
    for (const value of INVOICE_STATUSES) expect(sql).toContain(`'${value}'`);
  });

  it("keeps posted entries out of every soft-delete transition it can observe", () => {
    expect(sql).toMatch(/Posted journal entry % cannot be archived/);
    expect(sql).toContain("BEFORE UPDATE OF deleted_at");
  });
});

/**
 * The Drizzle model must declare the CHECKs the migrations install.
 *
 * 0249/0252/0253 added rules directly in SQL while the model kept claiming fewer,
 * so a reviewer reading `schema.ts` concluded a rule did not exist and a future
 * snapshot regeneration would treat the database's constraint as drift. This pins
 * both directions: the enum lists stay in the SQL, and every check name lives in the
 * model.
 */
describe("accounting CHECK constraints are declared in the model", () => {
  const schemaDir = path.resolve(import.meta.dirname, "../db/schema");
  const modelSource = [
    readFileSync(path.join(schemaDir, "accounting.ts"), "utf-8"),
    readFileSync(path.join(schemaDir, "accountingAccounts.ts"), "utf-8"),
    readFileSync(path.join(schemaDir, "accountingLedgerOps.ts"), "utf-8"),
  ].join("\n");

  const readMigration = (file: string) => readFileSync(path.join(migrationDir, file), "utf-8");

  it("pins the account types and fiscal-year statuses in SQL (0252)", () => {
    const sql = readMigration("0252_finance_enum_checks.sql");
    for (const value of ACCOUNTING_ACCOUNT_TYPES) expect(sql).toContain(`'${value}'`);
    for (const value of FISCAL_YEAR_STATUSES) expect(sql).toContain(`'${value}'`);
  });

  it("pins the posting-period statuses in SQL (0253)", () => {
    const sql = readMigration("0253_accounting_schema_integrity.sql");
    expect(sql).toContain("accounting_posting_periods_status_check");
    for (const value of POSTING_PERIOD_STATUSES) expect(sql).toContain(`'${value}'`);
  });

  it("declares every database check in the Drizzle model", () => {
    const databaseChecks = [
      "accounting_accounts_type_chk",
      "accounting_accounts_parent_not_self_chk",
      "accounting_entries_status_chk",
      "accounting_entries_source_type_chk",
      "accounting_fiscal_years_status_chk",
      "accounting_posting_periods_status_check",
      "accounting_posting_periods_range_chk",
      "accounting_journal_lines_nonneg_chk",
      "accounting_journal_lines_single_side_chk",
      "accounting_journal_lines_txn_sign_chk",
      "accounting_journal_lines_func_sign_chk",
      "accounting_journal_lines_func_debit_mirror_chk",
      "accounting_journal_lines_func_credit_mirror_chk",
      "accounting_journal_lines_rate_positive_chk",
    ];
    for (const name of databaseChecks) {
      expect(modelSource, `${name} must be declared in the schema model`).toContain(name);
    }
  });
});
