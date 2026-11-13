import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { JournalEntry } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  accountingAccounts,
  accountingBankStatements,
  accountingEntries,
  accountingFiscalYears,
  accountingJournalLines,
  accountingOpeningBalances,
  accountingPostingRules,
  accountingVoucherCounters,
  workspaces,
} from "../../db/schema.js";
import { findEntryById } from "../../db/repositories/accountingRepository.js";
import { listEntriesPage } from "../../db/repositories/accountingRepositoryListEntries.js";
import { listAccountsPage } from "../../db/repositories/accountingRepositoryListPages.js";

/**
 * The test connection is a PostgreSQL superuser, which bypasses RLS even with
 * FORCE. The raw-policy probes therefore `SET LOCAL ROLE` to a plain role first,
 * so they exercise the policies the application runs under in production.
 */
const PROBE_ROLE = "accounting_rls_probe";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Cross-tenant isolation for the accounting surfaces: the application predicates
 * and the database policies must both refuse to cross a workspace boundary.
 *
 * Two live tenants share the same tables here; every read is made as tenant A and
 * must never observe B — including the ledger-ops tables whose RLS arrived in
 * migration 0256 (posting rules, opening balances, bank statements).
 */

const TENANT_A = "isolation-acct-a";
const TENANT_B = "isolation-acct-b";

async function purge(): Promise<void> {
  for (const tenant of [TENANT_A, TENANT_B]) {
    await withTenant(tenant, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    });
  }
}

function entry(id: string, workspaceAccount: string): JournalEntry {
  return {
    id,
    date: "2026-06-01",
    ref: `REF-${id}`,
    description: "",
    status: "posted",
    created_by: "u1",
    fiscal_year: "",
    tags: [],
    attachments: [],
    lines: [
      { id: `${id}-d`, account_id: workspaceAccount, debit: 10, credit: 0, description: "" },
      { id: `${id}-c`, account_id: workspaceAccount, debit: 0, credit: 10, description: "" },
    ],
  };
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await withTenant(TENANT_A, async (tx) => {
    // DDL/role statements cannot take bind parameters.
    await tx.execute(
      sql.raw(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${PROBE_ROLE}') THEN
            CREATE ROLE accounting_rls_probe NOLOGIN;
          END IF;
        END $$;
        GRANT USAGE ON SCHEMA public TO accounting_rls_probe;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO accounting_rls_probe;
      `),
    );
  });
  await purge();

  for (const [tenant, accountId] of [
    [TENANT_A, "a-cash"],
    [TENANT_B, "b-cash"],
  ] as const) {
    await withTenant(tenant, async (tx) => {
      await tx
        .insert(workspaces)
        .values({ id: tenant, subdomain: tenant, madrasaName: tenant, enabled: true });
      await tx.insert(accountingAccounts).values({
        id: accountId,
        workspaceSubdomain: tenant,
        code: "1000",
        name: "Cash",
        type: "Asset",
      });
      await tx.insert(accountingPostingRules).values({
        workspaceSubdomain: tenant,
        arAccountId: accountId,
      });
      await tx.insert(accountingVoucherCounters).values({
        workspaceSubdomain: tenant,
        formatKey: "standard",
        periodYear: 2026,
        lastValue: 7,
      });
    });
  }

  // Post one entry in each workspace (raw rows: the isolation suite is not about
  // the posting guards).
  for (const [tenant, accountId] of [
    [TENANT_A, "a-cash"],
    [TENANT_B, "b-cash"],
  ] as const) {
    await withTenant(tenant, async (tx) => {
      const record = entry(tenant === TENANT_A ? "ent-a" : "ent-b", accountId);
      await tx.insert(accountingEntries).values({
        id: record.id,
        workspaceSubdomain: tenant,
        date: record.date,
        ref: record.ref,
        description: "",
        status: "posted",
        createdBy: "u1",
        fiscalYear: "",
      });
      await tx.insert(accountingJournalLines).values(
        record.lines.map((line) => ({
          id: line.id,
          workspaceSubdomain: tenant,
          entryId: record.id,
          accountId: line.account_id,
          debit: String(line.debit),
          credit: String(line.credit),
          description: "",
        })),
      );
      await tx.insert(accountingFiscalYears).values({
        id: "fy-1",
        workspaceSubdomain: tenant,
        label: "2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active",
      });
      await tx.insert(accountingOpeningBalances).values({
        id: `ob-${tenant}`,
        workspaceSubdomain: tenant,
        fiscalYearId: "fy-1",
        accountId,
        debit: "5",
        credit: "0",
      });
      await tx.insert(accountingBankStatements).values({
        id: `bs-${tenant}`,
        workspaceSubdomain: tenant,
        accountId,
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        openingBalance: "0",
        closingBalance: "0",
      });
    });
  }
});

afterAll(async () => {
  await purge().catch(() => undefined);
  await closeDatabase().catch(() => undefined);
});

describe("tenant A never sees tenant B's accounting rows", () => {
  it("cannot fetch another workspace's journal entry by id", async () => {
    await expect(withTenant(TENANT_A, () => findEntryById(TENANT_A, "ent-b"))).resolves.toBeNull();
    await expect(
      withTenant(TENANT_A, () => findEntryById(TENANT_A, "ent-a")),
    ).resolves.toMatchObject({ id: "ent-a" });
  });

  it("lists only its own entries and accounts", async () => {
    const page = await listEntriesPage(TENANT_A, { page: 1, limit: 100 });
    expect(page.entries.map((row) => row.id)).toEqual(["ent-a"]);

    const accounts = await listAccountsPage(TENANT_A, { page: 1, limit: 100 });
    expect(accounts.accounts.map((row) => row.id)).toEqual(["a-cash"]);
  });

  it("RLS filters a predicate-less raw read to the request tenant", async () => {
    // No `workspace_subdomain` filter: only the policy can scope this. Runs as the
    // plain probe role because the test connection is a superuser (bypasses RLS).
    const rows = await withTenant(TENANT_A, async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE accounting_rls_probe`);
      return tx.select({ id: accountingJournalLines.id }).from(accountingJournalLines);
    });
    expect(rows.map((row) => row.id).sort()).toEqual(["ent-a-c", "ent-a-d"]);
  });

  it("refuses updates and writes that target another workspace", async () => {
    const updated = await withTenant(TENANT_A, async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE accounting_rls_probe`);
      return tx
        .update(accountingAccounts)
        .set({ name: "hijacked" })
        .where(eq(accountingAccounts.id, "b-cash"))
        .returning({ id: accountingAccounts.id });
    });
    expect(updated).toEqual([]);

    // The policy's WITH CHECK refuses a row stamped with another workspace, even
    // when the statement runs as a plain (non-superuser) role.
    const crossTenantInsert = withTenant(TENANT_A, async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE accounting_rls_probe`);
      return tx.insert(accountingEntries).values({
        id: "ent-cross",
        workspaceSubdomain: TENANT_B,
        date: "2026-06-01",
        ref: "CROSS",
        description: "",
        status: "posted",
        createdBy: "u1",
        fiscalYear: "",
      });
    });
    await expect(crossTenantInsert).rejects.toThrow();
  });

  it("keeps the ledger-ops tables tenant-scoped (0256)", async () => {
    const rules = await withTenant(TENANT_A, async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE accounting_rls_probe`);
      return tx
        .select({ workspace: accountingPostingRules.workspaceSubdomain })
        .from(accountingPostingRules);
    });
    expect(rules).toEqual([{ workspace: TENANT_A }]);

    const opening = await withTenant(TENANT_A, async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE accounting_rls_probe`);
      return tx.select({ id: accountingOpeningBalances.id }).from(accountingOpeningBalances);
    });
    expect(opening).toEqual([{ id: `ob-${TENANT_A}` }]);

    const statements = await withTenant(TENANT_A, async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE accounting_rls_probe`);
      return tx.select({ id: accountingBankStatements.id }).from(accountingBankStatements);
    });
    expect(statements).toEqual([{ id: `bs-${TENANT_A}` }]);

    const counters = await withTenant(TENANT_A, async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE accounting_rls_probe`);
      return tx
        .select({ workspace: accountingVoucherCounters.workspaceSubdomain })
        .from(accountingVoucherCounters)
        .where(and(eq(accountingVoucherCounters.periodYear, 2026)));
    });
    expect(counters).toEqual([{ workspace: TENANT_A }]);
  });
});
