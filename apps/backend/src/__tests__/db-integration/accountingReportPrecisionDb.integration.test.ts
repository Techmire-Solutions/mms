import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { accountingReportAggregatesSchema } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import {
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  workspaces,
} from "../../db/schema.js";
import { aggregateAccountingReport } from "../../db/repositories/accountingRepositoryReport.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const SUFFIX = randomUUID().slice(0, 8);
const TENANT = `report-cents-${SUFFIX}`;
const CASH = `cash-${SUFFIX}`;
const REVENUE = `rev-${SUFFIX}`;
const EXPENSE = `exp-${SUFFIX}`;

async function purge(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const table of ["accounting_journal_lines", "accounting_entries", "accounting_accounts"]) {
      await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE workspace_subdomain = '${TENANT}'`));
    }
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withGlobalTenant(async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Report cents",
      enabled: true,
    });
  });
  await withTenant(TENANT, async (tx) => {
    await tx.insert(accountingAccounts).values([
      { id: CASH, workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      { id: REVENUE, workspaceSubdomain: TENANT, code: "4000", name: "Fees", type: "Revenue" },
      { id: EXPENSE, workspaceSubdomain: TENANT, code: "5000", name: "Salary", type: "Expense" },
    ]);
    await tx.insert(accountingEntries).values([
      { id: `e1-${SUFFIX}`, workspaceSubdomain: TENANT, date: "2026-03-01", status: "posted" },
      { id: `e2-${SUFFIX}`, workspaceSubdomain: TENANT, date: "2026-03-02", status: "posted" },
      { id: `e3-${SUFFIX}`, workspaceSubdomain: TENANT, date: "2026-04-01", status: "posted" },
    ]);
    await tx.insert(accountingJournalLines).values([
      // 0.10 + 0.20 = 0.3 exactly; the old float sum produced 0.30000000000000004.
      {
        id: `l1-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e1-${SUFFIX}`,
        accountId: CASH,
        debit: "0.10",
        credit: "0",
      },
      {
        id: `l2-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e1-${SUFFIX}`,
        accountId: REVENUE,
        debit: "0",
        credit: "0.10",
      },
      {
        id: `l3-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e2-${SUFFIX}`,
        accountId: CASH,
        debit: "0.20",
        credit: "0",
      },
      {
        id: `l4-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e2-${SUFFIX}`,
        accountId: REVENUE,
        debit: "0",
        credit: "0.20",
      },
      {
        id: `l5-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e3-${SUFFIX}`,
        accountId: EXPENSE,
        debit: "0.30",
        credit: "0",
      },
      {
        id: `l6-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e3-${SUFFIX}`,
        accountId: CASH,
        debit: "0",
        credit: "0.30",
      },
    ]);
  });
});

afterAll(async () => {
  await purge();
  await closeDatabase();
});

describe("report aggregates are exact in cents", () => {
  it("returns 0.3, not 0.30000000000000004, for 0.10 + 0.20", async () => {
    const report = await aggregateAccountingReport(TENANT, {
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });

    expect(report.revenue).toBe(0.3);
    expect(report.expenses).toBe(0.3);
    expect(report.netSurplus).toBe(0);
    expect(report.cashInflow).toBe(0.3);
    expect(report.cashOutflow).toBe(0.3);
    expect(report.netCashFlow).toBe(0);
    // Cash 0.10 + 0.20 − 0.30 starts and ends at zero.
    expect(report.assets).toBe(0);
    expect(report.equity).toBe(0);

    // The strict 2-dp/safe-cents response schema accepts every figure.
    expect(accountingReportAggregatesSchema.safeParse(report).success).toBe(true);
  });
});
