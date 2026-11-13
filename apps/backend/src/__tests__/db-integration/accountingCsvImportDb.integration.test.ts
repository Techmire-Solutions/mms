import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { accountingAccounts, workspaces } from "../../db/schema.js";
import { withTenant } from "../../db/tenant-context.js";
import { runWithTenant, bindRequestUserId } from "../../lib/tenantContext.js";
import { importAccountingAccounts } from "../../services/backgroundJobAccountingRunners.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "accounting-csv-import";

async function cleanup(): Promise<void> {
  const { tx, commit, rollback } = await beginLongLivedTenantTransaction(null, {
    allowGlobal: true,
  });
  try {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(accountingAccounts).where(eq(accountingAccounts.workspaceSubdomain, TENANT));
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
    await commit();
  } catch (error) {
    await rollback().catch(() => undefined);
    throw error;
  }
}

const ctx = () => ({
  tenant: TENANT,
  userId: "u-csv",
  updateProgress: vi.fn().mockResolvedValue(undefined),
});

const accounts = (): Array<{ code: string; name: string; type: string }> => [
  { code: "1000", name: "Cash", type: "Asset" },
  { code: "1100", name: "Fee Receivable", type: "Asset" },
  { code: "4000", name: "Fee Income", type: "Revenue" },
];

async function countAccounts(): Promise<number> {
  const result = await withTenant(TENANT, (tx) =>
    tx.execute(sql`
      SELECT count(*)::int AS n FROM accounting_accounts WHERE workspace_subdomain = ${TENANT}
    `),
  );
  return Number((result.rows as Array<{ n: number }>)[0]?.n ?? 0);
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await cleanup();
  const { tx, commit } = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  await tx
    .insert(workspaces)
    .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: TENANT, enabled: true });
  await commit();
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

describe("accounting:import chart-of-accounts runner", () => {
  it("creates the chart from CSV rows", async () => {
    const result = await runWithTenant(TENANT, () => {
      bindRequestUserId("u-csv");
      return importAccountingAccounts(accounts(), ctx());
    });
    expect(result).toMatchObject({ imported: 3, failed: 0, total: 3 });
    expect(await countAccounts()).toBe(3);
  });

  it("updates the same rows when the job is replayed", async () => {
    const renamed = accounts();
    renamed[0] = { ...renamed[0], name: "Cash on hand" };
    const result = await runWithTenant(TENANT, () => {
      bindRequestUserId("u-csv");
      return importAccountingAccounts(renamed, ctx());
    });
    expect(result.imported).toBe(3);
    // Replay safety comes from the code→id resolution, not the job id.
    expect(await countAccounts()).toBe(3);

    const cashResult = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT id, name FROM accounting_accounts
         WHERE workspace_subdomain = ${TENANT} AND code = '1000'
      `),
    );
    const cash = (cashResult.rows as Array<{ id: string; name: string }>)[0];
    expect(cash?.name).toBe("Cash on hand");
  });

  it("reports invalid rows without writing them", async () => {
    const result = await runWithTenant(TENANT, () => {
      bindRequestUserId("u-csv");
      return importAccountingAccounts(
        [
          { code: "2000", name: "Expenses", type: "Expense" },
          { code: "2100", name: "Wrong", type: "Bogus" },
          { code: "", name: "No code", type: "Asset" },
        ],
        ctx(),
      );
    });
    expect(result).toMatchObject({ imported: 1, failed: 2 });
    expect(await countAccounts()).toBe(4);
  });
});
