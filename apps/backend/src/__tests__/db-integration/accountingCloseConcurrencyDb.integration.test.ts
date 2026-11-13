import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import {
  accountingAccounts,
  accountingEntries,
  accountingFiscalYears,
  auditTrailEvents,
  workspaces,
} from "../../db/schema.js";
import { closeFiscalYearForTenant } from "../../accounting/use-cases/accountingPeriodClose.js";
import { createAccountingUseCases } from "../../accounting/use-cases/accountingUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const SUFFIX = randomUUID().slice(0, 8);
const TENANT = `close-race-${SUFFIX}`;
const CASH = `cash-${SUFFIX}`;
const REVENUE = `revenue-${SUFFIX}`;
const RETAINED = `retained-${SUFFIX}`;
const FY_2026 = `fy-2026-${SUFFIX}`;
const FY_2027 = `fy-2027-${SUFFIX}`;

async function cleanup(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const table of [
      "audit_trail_events",
      "accounting_journal_lines",
      "accounting_entries",
      "accounting_fiscal_years",
      "accounting_accounts",
    ]) {
      await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE workspace_subdomain = '${TENANT}'`));
    }
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
  });
}

function entry(id: string, date: string, amount: number) {
  return {
    id,
    date,
    ref: "",
    description: id,
    status: "posted" as const,
    created_by: "tester",
    fiscal_year: "",
    tags: [],
    attachments: [],
    lines: [
      { id: `${id}-d`, account_id: CASH, debit: amount, credit: 0, description: "" },
      { id: `${id}-c`, account_id: REVENUE, debit: 0, credit: amount, description: "" },
    ],
  };
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await cleanup();
  await withGlobalTenant(async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: TENANT,
      enabled: true,
    });
  });
  await withTenant(TENANT, async (tx) => {
    await tx.insert(accountingAccounts).values([
      { id: CASH, workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      { id: REVENUE, workspaceSubdomain: TENANT, code: "4100", name: "Fees", type: "Revenue" },
      { id: RETAINED, workspaceSubdomain: TENANT, code: "3100", name: "Retained", type: "Equity" },
    ]);
    await tx.insert(accountingFiscalYears).values([
      {
        id: FY_2026,
        workspaceSubdomain: TENANT,
        label: "FY 2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active",
      },
      {
        id: FY_2027,
        workspaceSubdomain: TENANT,
        label: "FY 2027",
        startDate: "2027-01-01",
        endDate: "2027-12-31",
        status: "active",
      },
    ]);
  });
  const useCases = createAccountingUseCases();
  await runWithTenant(TENANT, () =>
    useCases.upsertEntries([entry(`e-${SUFFIX}`, "2026-03-01", 500)]),
  );
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

async function closeState(fiscalYearId: string) {
  const [year] = await withTenant(TENANT, (tx) =>
    tx
      .select({ status: accountingFiscalYears.status })
      .from(accountingFiscalYears)
      .where(
        and(
          eq(accountingFiscalYears.workspaceSubdomain, TENANT),
          eq(accountingFiscalYears.id, fiscalYearId),
        ),
      ),
  );
  const closingEntries = await withTenant(TENANT, (tx) =>
    tx
      .select({ id: accountingEntries.id })
      .from(accountingEntries)
      .where(
        and(
          eq(accountingEntries.workspaceSubdomain, TENANT),
          eq(accountingEntries.sourceType, "closing"),
          eq(accountingEntries.sourceId, fiscalYearId),
        ),
      ),
  );
  const audits = await withTenant(TENANT, (tx) =>
    tx
      .select({ id: auditTrailEvents.id })
      .from(auditTrailEvents)
      .where(
        and(
          eq(auditTrailEvents.workspaceSubdomain, TENANT),
          eq(auditTrailEvents.tableName, "accounting_fiscal_years"),
          eq(auditTrailEvents.recordId, fiscalYearId),
        ),
      ),
  );
  return {
    status: year?.status,
    closingEntries: closingEntries.length,
    audits: audits.length,
  };
}

describe("parallel fiscal-year closes (Postgres)", () => {
  it("closes exactly once when two closes race", async () => {
    const results = await Promise.allSettled([
      runWithTenant(TENANT, () => closeFiscalYearForTenant(TENANT, FY_2026, "user-1", RETAINED)),
      runWithTenant(TENANT, () => closeFiscalYearForTenant(TENANT, FY_2026, "user-2", RETAINED)),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/already closed/);

    const state = await closeState(FY_2026);
    expect(state.status).toBe("closed");
    expect(state.closingEntries).toBe(1);
    expect(state.audits).toBe(1);
  });

  it("either includes a concurrent posting or rejects it, never half-closes", async () => {
    const useCases = createAccountingUseCases();
    const posting = runWithTenant(TENANT, () =>
      useCases.upsertEntries([entry(`e-race-${SUFFIX}`, "2027-06-01", 250)]),
    );
    const closing = runWithTenant(TENANT, () =>
      closeFiscalYearForTenant(TENANT, FY_2027, "user-3", RETAINED),
    );

    const [postingResult, closingResult] = await Promise.allSettled([posting, closing]);
    expect(closingResult.status).toBe("fulfilled");

    const state = await closeState(FY_2027);
    expect(state.status).toBe("closed");
    expect(state.audits).toBe(1);
    // A year with no P&L movement closes without a closing entry; if the racing
    // posting won, its revenue must be swept into retained earnings.
    expect(state.closingEntries).toBe(postingResult.status === "fulfilled" ? 1 : 0);

    if (postingResult.status === "fulfilled") {
      const posted = await withTenant(TENANT, (tx) =>
        tx
          .select({ id: accountingEntries.id })
          .from(accountingEntries)
          .where(
            and(
              eq(accountingEntries.workspaceSubdomain, TENANT),
              eq(accountingEntries.id, `e-race-${SUFFIX}`),
            ),
          ),
      );
      expect(posted).toHaveLength(1);
    } else {
      // The close won the race: the posting must be rejected and leave no row.
      const posted = await withTenant(TENANT, (tx) =>
        tx
          .select({ id: accountingEntries.id })
          .from(accountingEntries)
          .where(
            and(
              eq(accountingEntries.workspaceSubdomain, TENANT),
              eq(accountingEntries.id, `e-race-${SUFFIX}`),
            ),
          ),
      );
      expect(posted).toHaveLength(0);
    }
  });
});
