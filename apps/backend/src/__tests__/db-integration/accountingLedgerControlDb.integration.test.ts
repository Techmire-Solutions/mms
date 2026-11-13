import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  accountingAccounts,
  accountingCurrencySettings,
  accountingEntries,
  accountingFiscalYears,
  accountingJournalLines,
  accountingPostingPeriods,
  workspaces,
} from "../../db/schema.js";
import {
  replaceFiscalYearsForWorkspace,
  saveFiscalYear,
} from "../../db/repositories/accountingFiscalYearsRepository.js";
import { requireDatabaseConnection, uniqueTenant } from "./dbTestSupport.js";
import type { FiscalYear } from "@mms/shared";

/**
 * Domain-level ledger controls that used to live only in TypeScript (0254).
 *
 * Each case writes through raw SQL, i.e. exactly like a restore, an import or an ops
 * script that never calls `prepareJournalEntryForPersist`, and asserts the database
 * refuses it on its own.
 */
const TENANT = uniqueTenant("accounting-ledger-control");
const RESTORE_TENANT = uniqueTenant("accounting-ledger-restore");

async function purge(tenant: string): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
  });
}

async function expectGuardFailure(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const err = error as { message?: string; cause?: { message?: string } };
    expect(`${err.message ?? ""} ${err.cause?.message ?? ""}`).toMatch(pattern);
    return;
  }
  throw new Error("expected the database guard to reject the write");
}

interface RawFxLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  txnCurrency?: string | null;
  txnDebit?: string | null;
  txnCredit?: string | null;
  exchangeRate?: string | null;
}

/** Writes an entry + lines the way a restore/import would: no application guard. */
async function insertRawEntry(
  tenant: string,
  entry: {
    id: string;
    date: string;
    status?: "posted" | "draft";
    sourceType?: string | null;
    sourceId?: string | null;
  },
  lines: RawFxLine[],
): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx.insert(accountingEntries).values({
      id: entry.id,
      workspaceSubdomain: tenant,
      date: entry.date,
      ref: `REF-${entry.id}`,
      description: "raw",
      status: entry.status ?? "posted",
      createdBy: "raw-test",
      fiscalYear: "",
      sourceType: entry.sourceType ?? null,
      sourceId: entry.sourceId ?? null,
    });
    if (lines.length > 0) {
      await tx.insert(accountingJournalLines).values(
        lines.map((line) => ({
          id: line.id,
          workspaceSubdomain: tenant,
          entryId: entry.id,
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          // The 0249 mirror check pins the functional columns to the ledger columns.
          funcDebit: line.debit,
          funcCredit: line.credit,
          txnCurrency: line.txnCurrency ?? null,
          txnDebit: line.txnDebit ?? null,
          txnCredit: line.txnCredit ?? null,
          exchangeRate: line.exchangeRate ?? null,
          description: "",
        })),
      );
    }
  });
}

const year = (
  id: string,
  label: string,
  startDate: string,
  endDate: string,
  status: FiscalYear["status"],
): FiscalYear => ({ id, label, startDate, endDate, status });

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge(TENANT);
  await purge(RESTORE_TENANT);

  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Ledger control", enabled: true });
    await tx.insert(accountingAccounts).values([
      { id: "lc-cash", workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      { id: "lc-income", workspaceSubdomain: TENANT, code: "4000", name: "Fees", type: "Revenue" },
      { id: "lc-parent", workspaceSubdomain: TENANT, code: "1100", name: "Bank", type: "Asset" },
      {
        id: "lc-child",
        workspaceSubdomain: TENANT,
        code: "1110",
        name: "Bank — main",
        type: "Asset",
        parentAccountId: "lc-parent",
      },
      { id: "lc-legacy", workspaceSubdomain: TENANT, code: "1200", name: "Legacy", type: "Asset" },
    ]);
    await tx.insert(accountingCurrencySettings).values({
      workspaceSubdomain: TENANT,
      functionalCurrency: "PKR",
      presentationCurrency: "PKR",
      updatedAt: new Date(),
    });
  });

  // Calendar: 2026 open, 2025 closed with its periods closed, 2024 "closed" while its
  // periods were left open (the state a bypassing writer used to be able to exploit).
  await saveFiscalYear(TENANT, year("lc-fy-2026", "2026", "2026-01-01", "2026-12-31", "active"));
  await saveFiscalYear(TENANT, year("lc-fy-2025", "2025", "2025-01-01", "2025-12-31", "closed"));
  await saveFiscalYear(TENANT, year("lc-fy-2024", "2024", "2024-01-01", "2024-12-31", "active"));
  await withTenant(TENANT, async (tx) => {
    // Bypass `syncPostingPeriods` on purpose: a year marked closed with its months
    // still open is the state a direct writer used to be able to exploit.
    await tx
      .update(accountingFiscalYears)
      .set({ status: "closed" })
      .where(eq(accountingFiscalYears.id, "lc-fy-2024"));
  });
});

afterAll(async () => {
  try {
    await purge(TENANT);
    await purge(RESTORE_TENANT);
  } finally {
    await closeDatabase();
  }
});

describe("single-currency voucher balance at commit (0254)", () => {
  it("rejects a foreign voucher whose document legs do not balance", async () => {
    // Functional PKR balances (28,000 = 20,000 + 8,000 thanks to per-line rates) while
    // the USD document itself is short by 80 — the shape that used to pass silently.
    await expectGuardFailure(
      insertRawEntry(TENANT, { id: "fx-imbalanced", date: "2026-05-01" }, [
        {
          id: "fx-i-1",
          accountId: "lc-cash",
          debit: "28000.00",
          credit: "0",
          txnCurrency: "USD",
          txnDebit: "100.00",
          txnCredit: "0.00",
          exchangeRate: "280",
        },
        {
          id: "fx-i-2",
          accountId: "lc-cash",
          debit: "0",
          credit: "20000.00",
          txnCurrency: "USD",
          txnDebit: "0.00",
          txnCredit: "100.00",
          exchangeRate: "200",
        },
        {
          id: "fx-i-3",
          accountId: "lc-income",
          debit: "0",
          credit: "8000.00",
          txnCurrency: "USD",
          txnDebit: "0.00",
          txnCredit: "80.00",
          exchangeRate: "100",
        },
      ]),
      /does not balance in its transaction currency: USD/,
    );
  });

  it("accepts a balanced foreign voucher", async () => {
    await expect(
      insertRawEntry(TENANT, { id: "fx-balanced", date: "2026-05-02" }, [
        {
          id: "fx-b-1",
          accountId: "lc-cash",
          debit: "28000.00",
          credit: "0",
          txnCurrency: "USD",
          txnDebit: "100.00",
          txnCredit: "0.00",
          exchangeRate: "280",
        },
        {
          id: "fx-b-2",
          accountId: "lc-income",
          debit: "0",
          credit: "28000.00",
          txnCurrency: "USD",
          txnDebit: "0.00",
          txnCredit: "100.00",
          exchangeRate: "280",
        },
      ]),
    ).resolves.toBeUndefined();
  });

  it("accepts a mixed-currency settlement entry (legs differ by design)", async () => {
    // Retire a USD receivable against PKR cash and book the realised gain.
    await expect(
      insertRawEntry(TENANT, { id: "fx-settlement", date: "2026-05-03" }, [
        {
          id: "fx-s-1",
          accountId: "lc-income",
          debit: "0",
          credit: "28000.00",
          txnCurrency: "USD",
          txnDebit: "0.00",
          txnCredit: "1000.00",
          exchangeRate: "28",
        },
        {
          id: "fx-s-2",
          accountId: "lc-cash",
          debit: "28500.00",
          credit: "0",
          txnCurrency: "PKR",
          txnDebit: "28500.00",
          txnCredit: "0.00",
          exchangeRate: "1",
        },
        {
          id: "fx-s-3",
          accountId: "lc-income",
          debit: "0",
          credit: "500.00",
          txnCurrency: "PKR",
          txnDebit: "0.00",
          txnCredit: "500.00",
          exchangeRate: "1",
        },
      ]),
    ).resolves.toBeUndefined();
  });

  it("skips a currency whose legs predate the IAS 21 backfill", async () => {
    await expect(
      insertRawEntry(TENANT, { id: "fx-legacy", date: "2026-05-04" }, [
        {
          id: "fx-l-1",
          accountId: "lc-cash",
          debit: "100.00",
          credit: "0",
          txnCurrency: "USD",
          txnDebit: "100.00",
          txnCredit: null,
        },
        {
          id: "fx-l-2",
          accountId: "lc-income",
          debit: "0",
          credit: "100.00",
          txnCurrency: "USD",
          txnDebit: null,
          txnCredit: "90.00",
        },
      ]),
    ).resolves.toBeUndefined();
  });
});

describe("summary (header) accounts cannot carry lines (0254)", () => {
  it("rejects a line on an account that has sub-accounts", async () => {
    await expectGuardFailure(
      insertRawEntry(TENANT, { id: "summary-line", date: "2026-05-04" }, [
        { id: "sl-1", accountId: "lc-parent", debit: "10.00", credit: "0" },
        { id: "sl-2", accountId: "lc-income", debit: "0", credit: "10.00" },
      ]),
      /summary account with sub-accounts/,
    );
  });

  it("rejects giving a child to an account that already carries journal lines", async () => {
    // `lc-cash` has lines; nesting `lc-legacy` under it would make `lc-cash` a summary
    // account that the line guard rejects — an inconsistent tree.
    await insertRawEntry(TENANT, { id: "legacy-lines", date: "2026-05-05" }, [
      { id: "ll-1", accountId: "lc-cash", debit: "10.00", credit: "0" },
      { id: "ll-2", accountId: "lc-income", debit: "0", credit: "10.00" },
    ]);

    await expectGuardFailure(
      withTenant(TENANT, (tx) =>
        tx.execute(
          sql`UPDATE accounting_accounts SET parent_account_id = 'lc-cash' WHERE id = 'lc-legacy'`,
        ),
      ),
      /Account lc-cash already carries journal lines and cannot become a parent/,
    );
  });
});

describe("closed fiscal year at commit (0254)", () => {
  it("rejects a posted entry in a closed year even when its periods are open", async () => {
    await expectGuardFailure(
      insertRawEntry(TENANT, { id: "closed-year", date: "2024-06-15" }, [
        { id: "cy-1", accountId: "lc-cash", debit: "5.00", credit: "0" },
        { id: "cy-2", accountId: "lc-income", debit: "0", credit: "5.00" },
      ]),
      /closed fiscal year 2024/,
    );
  });

  it("lets the registered year-end closing entry into the period it closes", async () => {
    await expect(
      insertRawEntry(
        TENANT,
        {
          id: "closing-entry",
          date: "2025-12-31",
          sourceType: "closing",
          sourceId: "lc-fy-2025",
        },
        [
          { id: "cl-1", accountId: "lc-income", debit: "100.00", credit: "0" },
          { id: "cl-2", accountId: "lc-cash", debit: "0", credit: "100.00" },
        ],
      ),
    ).resolves.toBeUndefined();
  });

  it("refuses a hand-labelled 'closing' entry that is not the registered closure", async () => {
    await expectGuardFailure(
      insertRawEntry(
        TENANT,
        { id: "fake-closing", date: "2025-12-30", sourceType: "closing", sourceId: "nope" },
        [
          { id: "fc-1", accountId: "lc-income", debit: "7.00", credit: "0" },
          { id: "fc-2", accountId: "lc-cash", debit: "0", credit: "7.00" },
        ],
      ),
      /closed fiscal year 2025/,
    );
  });

  it("refuses reopening a period of a closed fiscal year", async () => {
    await expectGuardFailure(
      withTenant(TENANT, (tx) =>
        tx
          .update(accountingPostingPeriods)
          .set({ status: "open" })
          .where(eq(accountingPostingPeriods.fiscalYearId, "lc-fy-2025")),
      ),
      /Cannot reopen posting period .* of a closed fiscal year/,
    );
  });

  it("still allows reopening a period of an open fiscal year", async () => {
    await withTenant(TENANT, async (tx) => {
      await tx
        .update(accountingPostingPeriods)
        .set({ status: "closed" })
        .where(
          sql`accounting_posting_periods.fiscal_year_id = 'lc-fy-2026' AND accounting_posting_periods.start_date = '2026-05-01'`,
        );
      await tx
        .update(accountingPostingPeriods)
        .set({ status: "open" })
        .where(
          sql`accounting_posting_periods.fiscal_year_id = 'lc-fy-2026' AND accounting_posting_periods.start_date = '2026-05-01'`,
        );
    });
  });
});

describe("restore regenerates the monthly periods", () => {
  it("recreates periods from restored years instead of leaving none", async () => {
    await withTenant(RESTORE_TENANT, async (tx) => {
      await tx.insert(workspaces).values({
        id: RESTORE_TENANT,
        subdomain: RESTORE_TENANT,
        madrasaName: "Restore",
        enabled: true,
      });
    });

    await replaceFiscalYearsForWorkspace(RESTORE_TENANT, [
      year("rs-fy-open", "2026", "2026-01-01", "2026-12-31", "active"),
      year("rs-fy-closed", "2025", "2025-01-01", "2025-12-31", "closed"),
    ]);

    const rows = await withTenant(RESTORE_TENANT, (tx) =>
      tx
        .select({
          fiscalYearId: accountingPostingPeriods.fiscalYearId,
          status: accountingPostingPeriods.status,
        })
        .from(accountingPostingPeriods),
    );
    const open = rows.filter((row) => row.fiscalYearId === "rs-fy-open");
    const closed = rows.filter((row) => row.fiscalYearId === "rs-fy-closed");
    // Every year gets its twelve months back (the rows cascade-deleted with the years).
    expect(open).toHaveLength(12);
    expect(closed).toHaveLength(12);
    // A closed year's months come back closed, so the database backstop survives.
    expect(open.every((row) => row.status === "open")).toBe(true);
    expect(closed.every((row) => row.status === "closed")).toBe(true);
  });
});
