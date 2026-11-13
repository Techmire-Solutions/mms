import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  workspaces,
} from "../../db/schema.js";
import { saveFiscalYear } from "../../db/repositories/accountingFiscalYearsRepository.js";
import {
  findClosedPostingPeriodForDate,
  listPostingPeriods,
} from "../../db/repositories/accountingPostingPeriodsRepository.js";
import { createAccountingUseCases } from "../../accounting/use-cases/accountingUseCases.js";
import {
  closePostingPeriod,
  reopenPostingPeriod,
} from "../../accounting/use-cases/accountingLedgerOpsUseCases.js";
import {
  entryForSource,
  persistGeneratedEntry,
} from "../../accounting/ledgerPosting/ledgerPostingHelpers.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import type { JournalEntry } from "@mms/shared";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * The monthly posting lock. `accounting_posting_periods` was written on every
 * fiscal-year save and read by nothing, so a "closed" period did not stop a
 * backdated invoice, payment or journal entry. Migration 0249 + the period guard
 * close both the application path and the raw-SQL path.
 */
const TENANT = "accounting-posting-period-lock";

const useCases = createAccountingUseCases();

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

/** Drizzle wraps a deferred-trigger failure thrown from COMMIT; assert the cause. */
async function expectGuardFailure(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const err = error as { message?: string; cause?: { message?: string } };
    expect(`${err.message ?? ""} ${err.cause?.message ?? ""}`).toMatch(pattern);
    return;
  }
  throw new Error("expected the ledger guard to reject the write");
}

function balancedLines(tag: string) {
  return [
    { id: `${tag}-d`, account_id: "acc-cash", debit: 10, credit: 0, description: "" },
    { id: `${tag}-c`, account_id: "acc-income", debit: 0, credit: 10, description: "" },
  ];
}

function entry(id: string, date: string): JournalEntry {
  return {
    id,
    date,
    ref: `REF-${id}`,
    description: "",
    status: "posted",
    created_by: "u1",
    fiscal_year: "",
    tags: [],
    attachments: [],
    lines: balancedLines(id),
  };
}

/** Seeds a calendar year so `syncPostingPeriods` generates its monthly periods. */
async function seedYear(id: string, status: "active" | "closed" = "active"): Promise<void> {
  await saveFiscalYear(TENANT, {
    id,
    label: `FY ${id}`,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status,
  });
}

async function periodFor(month: string) {
  const periods = await listPostingPeriods(TENANT, "fy-lock");
  const period = periods.find((row) => row.label === `2026-${month}`);
  if (!period) throw new Error(`period 2026-${month} not generated`);
  return period;
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Period lock", enabled: true });
    await tx.insert(accountingAccounts).values([
      { id: "acc-cash", workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      {
        id: "acc-income",
        workspaceSubdomain: TENANT,
        code: "4000",
        name: "Income",
        type: "Revenue",
      },
    ]);
  });
  await runWithTenant(TENANT, () => seedYear("fy-lock"));
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("posting periods are a real monthly lock (Postgres)", () => {
  it("generates the monthly periods of the fiscal year", async () => {
    const periods = await listPostingPeriods(TENANT, "fy-lock");
    expect(periods).toHaveLength(12);
    expect(periods[0]).toMatchObject({ label: "2026-01", status: "open", closedAt: null });
  });

  it("closes a period and attributes the lock", async () => {
    const period = await periodFor("05");
    const closed = await runWithTenant(TENANT, () =>
      closePostingPeriod(period.id, "admin-1", "May books"),
    );
    expect(closed.status).toBe("closed");
    expect(closed.closedBy).toBe("admin-1");
    expect(closed.closedAt).not.toBeNull();

    const audit = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT count(*)::int AS n FROM audit_trail_events
         WHERE workspace_subdomain = ${TENANT}
           AND table_name = 'accounting_posting_periods'
           AND record_id = ${period.id}
      `),
    );
    expect(Number((audit.rows as Array<{ n: number }>)[0]?.n ?? 0)).toBeGreaterThan(0);
  });

  it("rejects a journal entry dated inside the closed period", async () => {
    await expect(
      runWithTenant(TENANT, () => useCases.createJournalEntry(entry("je-may", "2026-05-15"))),
    ).rejects.toThrow(/closed/i);
  });

  it("accepts a journal entry in an open period", async () => {
    const created = await runWithTenant(TENANT, () =>
      useCases.createJournalEntry(entry("je-jun", "2026-06-15")),
    );
    expect(created.id).toBe("je-jun");
  });

  it("rejects a system-generated posting (invoice/payment path) in the closed period", async () => {
    await expect(
      runWithTenant(TENANT, () =>
        persistGeneratedEntry(
          TENANT,
          entryForSource(
            "invoice",
            "inv-may",
            "2026-05-20",
            "Invoice inv-may",
            balancedLines("gen"),
          ),
        ),
      ),
    ).rejects.toThrow(/closed/i);
  });

  it("rejects the same write at the database when the application guard is bypassed", async () => {
    await expectGuardFailure(
      withTenant(TENANT, async (tx) => {
        await tx.insert(accountingEntries).values({
          id: "raw-may",
          workspaceSubdomain: TENANT,
          date: "2026-05-10",
          ref: "RAW-MAY",
          description: "",
          status: "posted",
          createdBy: "raw",
          fiscalYear: "",
        });
        await tx.insert(accountingJournalLines).values(
          balancedLines("raw").map((line) => ({
            id: line.id,
            workspaceSubdomain: TENANT,
            entryId: "raw-may",
            accountId: line.account_id,
            debit: String(line.debit),
            credit: String(line.credit),
            description: "",
          })),
        );
      }),
      /closed posting period/i,
    );
  });

  it("allows the year-end closing entry into the period it closes", async () => {
    // The close writes its closing entry (source_type "closing") in the same
    // transaction that marks the periods closed, so it is the one posting that
    // must be exempt from the period backstop. `source_type` is server-owned, so a
    // client cannot claim it.
    await withTenant(TENANT, async (tx) => {
      await tx.insert(accountingEntries).values({
        id: "raw-closing",
        workspaceSubdomain: TENANT,
        date: "2026-05-31",
        ref: "CLOSING-FY-LOCK",
        description: "Close FY",
        status: "posted",
        createdBy: "system",
        fiscalYear: "",
        sourceType: "closing",
        sourceId: "fy-lock",
      });
      await tx.insert(accountingJournalLines).values(
        balancedLines("closing").map((line) => ({
          id: line.id,
          workspaceSubdomain: TENANT,
          entryId: "raw-closing",
          accountId: line.account_id,
          debit: String(line.debit),
          credit: String(line.credit),
          description: "",
        })),
      );
    });
  });

  it("requires reopening the period before it accepts backdated postings again", async () => {
    const period = await periodFor("05");
    const reopened = await runWithTenant(TENANT, () => reopenPostingPeriod(period.id, "admin-1"));
    expect(reopened.status).toBe("open");
    expect(reopened.closedAt).toBeNull();

    const created = await runWithTenant(TENANT, () =>
      useCases.createJournalEntry(entry("je-may-2", "2026-05-16")),
    );
    expect(created.id).toBe("je-may-2");
  });

  it("closes every period when the fiscal year is saved closed, and refuses to reopen one", async () => {
    await runWithTenant(TENANT, () => seedYear("fy-lock", "closed"));
    const periods = await listPostingPeriods(TENANT, "fy-lock");
    expect(periods.every((row) => row.status === "closed")).toBe(true);
    await expect(
      runWithTenant(TENANT, () => reopenPostingPeriod(periods[0]!.id, "admin-1")),
    ).rejects.toThrow(/closed fiscal year/i);
  });

  it("does not leak another tenant's periods or locks", async () => {
    const other = "accounting-posting-period-other";
    await withTenant(other, async (tx) => {
      await tx
        .insert(workspaces)
        .values({ id: other, subdomain: other, madrasaName: "Other", enabled: true });
    });
    try {
      // Both reads are tenant-scoped in SQL; the lock lookup must not see the
      // closed period of another workspace.
      expect(await listPostingPeriods(other)).toHaveLength(0);
      expect(await findClosedPostingPeriodForDate(other, "2026-05-15")).toBeNull();
    } finally {
      await withTenant(other, async (tx) => {
        await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
        await tx.delete(workspaces).where(eq(workspaces.subdomain, other));
      });
    }
  });
});
