import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { financeInvoices, workspaces } from "../../db/schema.js";
import { loadFinanceReportAggregatesSql } from "../../db/repositories/financeRepositoryReport.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "finance-report-agg-test";

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, (tx) =>
    tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Finance Report Agg Test",
      enabled: true,
    }),
  );
  await withTenant(TENANT, (tx) =>
    tx.insert(financeInvoices).values([
      {
        id: "inv-1",
        workspaceSubdomain: TENANT,
        studentId: "stu-1",
        dueDate: "2026-05-15",
        finalAmt: "100.00",
        paidAmt: "100.00",
        status: "paid",
      },
    ]),
  );
});

afterAll(async () => {
  await purgeTenant();
  await closeDatabase();
});

describe("loadFinanceReportAggregatesSql", () => {
  it("executes without error on real PostgreSQL database", async () => {
    const res = await loadFinanceReportAggregatesSql(TENANT);
    expect(res).toBeDefined();
    const monthly = res.monthlyFeeCollection ?? [];
    expect(monthly.length).toBeGreaterThanOrEqual(1);
    expect(monthly[0]?.month).toBe("2026-05");
    expect(monthly[0]?.collected).toBe(100);
  });

  it("handles comparison queries with date ranges and sessions", async () => {
    const res = await loadFinanceReportAggregatesSql(TENANT, {
      sessionIds: ["s1"],
      rangeAFrom: "2026-01-01",
      rangeATo: "2026-06-30",
      rangeBFrom: "2026-07-01",
      rangeBTo: "2026-12-31",
    });
    expect(res.comparison).toBeDefined();
    expect(res.comparison?.monthly.a.length).toBeGreaterThanOrEqual(1);
    expect(res.comparison?.monthly.b.length).toBe(0);
  });
});
