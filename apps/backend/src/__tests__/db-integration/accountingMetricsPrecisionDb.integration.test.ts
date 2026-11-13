import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import { accountingCommandMetricsSnapshotSchema } from "@mms/shared";
import {
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  workspaces,
} from "../../db/schema.js";
import { aggregateAccountingCommandMetrics } from "../../db/repositories/accountingRepositoryMetrics.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * 0253: the command-centre money aggregates used to SUM in `float8` and hand the
 * result to `Number(...)`.
 *
 * A float8 sum of 0.10 + 0.20 is 0.30000000000000004, which fails
 * `signedMoneyAmountSchema` ("at most two decimals") during response validation — a
 * dashboard 500 with no bad data behind it — and makes `surplus` disagree with
 * revenue − expenses. The sums now stay `numeric` and convert once, exactly.
 */
const TENANT = "accounting-metrics-precision";

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Metrics precision", enabled: true });
    await tx.insert(accountingAccounts).values([
      { id: "mp-cash", workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      { id: "mp-bank", workspaceSubdomain: TENANT, code: "1010", name: "Bank", type: "Asset" },
      {
        id: "mp-income",
        workspaceSubdomain: TENANT,
        code: "4000",
        name: "Income",
        type: "Revenue",
      },
    ]);
    await tx.insert(accountingEntries).values({
      id: "mp-entry",
      workspaceSubdomain: TENANT,
      date: "2026-05-01",
      ref: "JE-MP-1",
      status: "posted",
      createdBy: "tester",
      fiscalYear: "",
    });
    // 0.10 + 0.20 — the pair a float8 SUM cannot represent at two decimals.
    await tx.insert(accountingJournalLines).values([
      {
        id: "mp-l1",
        workspaceSubdomain: TENANT,
        entryId: "mp-entry",
        accountId: "mp-cash",
        debit: "0.10",
        credit: "0",
      },
      {
        id: "mp-l2",
        workspaceSubdomain: TENANT,
        entryId: "mp-entry",
        accountId: "mp-bank",
        debit: "0.20",
        credit: "0",
      },
      {
        id: "mp-l3",
        workspaceSubdomain: TENANT,
        entryId: "mp-entry",
        accountId: "mp-income",
        debit: "0",
        credit: "0.30",
      },
    ]);
  });
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("accounting command metrics stay exact", () => {
  it("returns two-decimal money that survives the response schema", async () => {
    const snapshot = await aggregateAccountingCommandMetrics(TENANT);
    const parsed = accountingCommandMetricsSnapshotSchema.safeParse(snapshot);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(snapshot.postedVolume).toBe(0.3);
    expect(snapshot.assets).toBe(0.3);
    expect(snapshot.revenue).toBe(0.3);
    expect(snapshot.expenses).toBe(0);
    expect(snapshot.surplus).toBe(0.3);
  });
});
