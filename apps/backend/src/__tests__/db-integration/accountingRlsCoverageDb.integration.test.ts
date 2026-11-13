import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Tenant isolation ratchet for the accounting schema.
 *
 * Every accounting table must be a tenant table at the *database* level: row-level
 * security enabled, forced (so the table owner is subject to it too), and a
 * policy that matches the transaction's `app.current_tenant`. Application
 * predicates are the first line; this is the backstop a raw-SQL or future report
 * path cannot skip.
 *
 * Migration 0256 closed the five ledger-ops tables (posting rules, opening
 * balances, bank statements/lines, reconciliation matches) that had none.
 */

const PROBE_TENANT = "accounting-rls-coverage";

interface TableRow {
  relname: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
}

interface PolicyRow {
  tablename: string;
  policyname: string;
}

async function accountingTables(): Promise<TableRow[]> {
  const result = await withTenant(PROBE_TENANT, (tx) =>
    tx.execute(sql`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND c.relname LIKE 'accounting\\_%'
       ORDER BY c.relname
    `),
  );
  return result.rows as unknown as TableRow[];
}

async function accountingPolicies(): Promise<PolicyRow[]> {
  const result = await withTenant(PROBE_TENANT, (tx) =>
    tx.execute(sql`
      SELECT tablename, policyname
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename LIKE 'accounting\\_%'
    `),
  );
  return result.rows as unknown as PolicyRow[];
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
});

afterAll(async () => {
  await closeDatabase().catch(() => undefined);
});

describe("accounting RLS coverage", () => {
  it("enables and forces row-level security on every accounting table", async () => {
    const tables = await accountingTables();
    expect(tables.length).toBeGreaterThanOrEqual(28);

    const unprotected = tables
      .filter((table) => !table.relrowsecurity || !table.relforcerowsecurity)
      .map((table) => table.relname);

    expect(unprotected).toEqual([]);
  });

  it("gives every accounting table a tenant policy", async () => {
    const tables = await accountingTables();
    const policies = await accountingPolicies();
    const withPolicy = new Set(policies.map((policy) => policy.tablename));

    expect(
      tables.filter((table) => !withPolicy.has(table.relname)).map((row) => row.relname),
    ).toEqual([]);
  });

  it("covers the five ledger-ops tables migration 0256 added", async () => {
    const tables = new Set((await accountingTables()).map((table) => table.relname));
    for (const table of [
      "accounting_posting_rules",
      "accounting_opening_balances",
      "accounting_bank_statements",
      "accounting_bank_statement_lines",
      "accounting_bank_reconciliations",
    ]) {
      expect(tables.has(table), table).toBe(true);
    }
  });
});
