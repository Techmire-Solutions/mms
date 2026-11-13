import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INVOICE_STATUSES, JOURNAL_SOURCE_TYPES } from "@mms/shared";

/**
 * Pins the database CHECK constraints introduced by 0248 to the shared arrays.
 * Lives in the backend because only this package can read migration files; the
 * shared package stays pure.
 */
describe("finance & accounting constraints ↔ shared enums", () => {
  const migrationDir = path.resolve(import.meta.dirname, "../db/migrations_drizzle");
  const sql = readFileSync(
    path.join(migrationDir, "0248_finance_accounting_integrity.sql"),
    "utf-8",
  );

  it("accepts every journal source type the app can write", () => {
    // A value missing here would make a real posting path fail on a CHECK the
    // shared list says is legal.
    for (const value of JOURNAL_SOURCE_TYPES) expect(sql).toContain(`'${value}'`);
  });

  it("accepts every invoice status the app can write", () => {
    for (const value of INVOICE_STATUSES) expect(sql).toContain(`'${value}'`);
  });

  it("keeps posted entries out of every soft-delete transition it can observe", () => {
    expect(sql).toMatch(/Posted journal entry % cannot be archived/);
    expect(sql).toContain("BEFORE UPDATE OF deleted_at");
  });
});
