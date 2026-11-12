import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import {
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  financeInvoices,
  students,
  workspaces,
} from "../../db/schema.js";
import {
  loadAccountLedger,
  loadReceivablesAging,
} from "../../accounting/use-cases/accountingReportEndpointsUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const SUFFIX = randomUUID().slice(0, 8);
const TENANT = `report-endpoints-${SUFFIX}`;
const CASH = `cash-${SUFFIX}`;
const REVENUE = `rev-${SUFFIX}`;
const EXPENSE = `exp-${SUFFIX}`;
const EQUITY = `eq-${SUFFIX}`;
const STUDENT = `stu-${SUFFIX}`;

async function purge(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const table of [
      "accounting_journal_lines",
      "accounting_entries",
      "accounting_accounts",
      "finance_invoices",
      "students",
    ]) {
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
      madrasaName: "Report endpoints",
      enabled: true,
    });
  });
  await withTenant(TENANT, async (tx) => {
    await tx.insert(students).values({
      id: STUDENT,
      workspaceSubdomain: TENANT,
      status: "active",
    });
    await tx.insert(accountingAccounts).values([
      { id: CASH, workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      { id: EQUITY, workspaceSubdomain: TENANT, code: "3000", name: "Capital", type: "Equity" },
      { id: REVENUE, workspaceSubdomain: TENANT, code: "4000", name: "Fees", type: "Revenue" },
      { id: EXPENSE, workspaceSubdomain: TENANT, code: "5000", name: "Salary", type: "Expense" },
    ]);
    const entries = [
      { id: `e-open-${SUFFIX}`, date: "2025-12-31", status: "posted" },
      { id: `e-fee-${SUFFIX}`, date: "2026-03-01", status: "posted" },
      { id: `e-sal-${SUFFIX}`, date: "2026-04-01", status: "posted" },
      { id: `e-draft-${SUFFIX}`, date: "2026-05-01", status: "draft" },
      { id: `e-deleted-${SUFFIX}`, date: "2026-05-02", status: "posted", deletedAt: new Date() },
    ];
    await tx.insert(accountingEntries).values(
      entries.map((entry) => ({
        ...entry,
        workspaceSubdomain: TENANT,
        ref: entry.id,
        description: entry.id,
      })),
    );
    await tx.insert(accountingJournalLines).values([
      // Opening balance before the requested window.
      {
        id: `l-open-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e-open-${SUFFIX}`,
        accountId: CASH,
        debit: "1000",
        credit: "0",
      },
      {
        id: `l-open-e-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e-open-${SUFFIX}`,
        accountId: EQUITY,
        debit: "0",
        credit: "1000",
      },
      {
        id: `l-fee-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e-fee-${SUFFIX}`,
        accountId: CASH,
        debit: "500",
        credit: "0",
      },
      {
        id: `l-fee-r-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e-fee-${SUFFIX}`,
        accountId: REVENUE,
        debit: "0",
        credit: "500",
      },
      {
        id: `l-sal-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e-sal-${SUFFIX}`,
        accountId: EXPENSE,
        debit: "200",
        credit: "0",
      },
      {
        id: `l-sal-c-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e-sal-${SUFFIX}`,
        accountId: CASH,
        debit: "0",
        credit: "200",
      },
      // Excluded: draft and soft-deleted entries must not reach the ledger.
      {
        id: `l-draft-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e-draft-${SUFFIX}`,
        accountId: CASH,
        debit: "900",
        credit: "0",
      },
      {
        id: `l-deleted-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e-deleted-${SUFFIX}`,
        accountId: CASH,
        debit: "700",
        credit: "0",
      },
      {
        id: `l-deleted-c-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        entryId: `e-deleted-${SUFFIX}`,
        accountId: REVENUE,
        debit: "0",
        credit: "700",
      },
    ]);
    const invoices = [
      {
        id: `inv-a-${SUFFIX}`,
        dueDate: "2026-01-01",
        finalAmt: "1000",
        lateFeeAmt: "50",
        status: "overdue",
      },
      {
        id: `inv-b-${SUFFIX}`,
        dueDate: "2026-06-15",
        finalAmt: "500",
        paidAmt: "100",
        status: "partial",
      },
      { id: `inv-c-${SUFFIX}`, dueDate: "2026-12-31", finalAmt: "300", status: "pending" },
      {
        id: `inv-paid-${SUFFIX}`,
        dueDate: "2026-02-01",
        finalAmt: "800",
        paidAmt: "800",
        status: "paid",
      },
      {
        id: `inv-cancelled-${SUFFIX}`,
        dueDate: "2026-02-01",
        finalAmt: "800",
        status: "cancelled",
      },
      {
        id: `inv-deleted-${SUFFIX}`,
        dueDate: "2026-02-01",
        finalAmt: "800",
        status: "overdue",
        deletedAt: new Date(),
      },
    ];
    await tx.insert(financeInvoices).values(
      invoices.map((invoice) => ({
        ...invoice,
        workspaceSubdomain: TENANT,
        studentId: STUDENT,
        studentName: "Amina Student",
        class: "Hifz",
        session: "2026",
      })),
    );
  });
});

afterAll(async () => {
  await purge();
  await closeDatabase();
});

describe("server General Ledger", () => {
  const query = {
    accountId: CASH,
    dateFrom: "2026-01-01",
    dateTo: "2026-12-31",
    page: 1,
    limit: 100,
  };

  it("carries the opening balance, exact running balance and window totals", async () => {
    const page = await runWithTenant(TENANT, () => loadAccountLedger(query));

    expect(page.account).toEqual({
      id: CASH,
      code: "1000",
      name: "Cash",
      type: "Asset",
      subtype: "",
    });
    expect(page.openingBalance).toBe(1000);
    expect(page.lines).toHaveLength(2);
    expect(page.lines.map((line) => [line.date, line.debit, line.credit, line.running])).toEqual([
      ["2026-03-01", 500, 0, 1500],
      ["2026-04-01", 0, 200, 1300],
    ]);
    expect(page.totalDebit).toBe(500);
    expect(page.totalCredit).toBe(200);
    // Whole-window closing figure, not just the page slice.
    expect(page.closingBalance).toBe(1300);
    expect(page.total).toBe(2);
    expect(page.hasMore).toBe(false);
  });

  it("pages stably without repeating or skipping a line", async () => {
    const second = await runWithTenant(TENANT, () =>
      loadAccountLedger({ ...query, page: 2, limit: 1 }),
    );
    expect(second.lines).toHaveLength(1);
    expect(second.lines[0]?.date).toBe("2026-04-01");
    expect(second.lines[0]?.running).toBe(1300);
    expect(second.total).toBe(2);
    expect(second.hasMore).toBe(false);
  });

  it("404s for an account outside the tenant", async () => {
    await expect(
      runWithTenant(TENANT, () => loadAccountLedger({ ...query, accountId: "missing-account" })),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("receivables aging", () => {
  it("buckets open invoices by days past due and excludes settled ones", async () => {
    const aging = await runWithTenant(TENANT, () => loadReceivablesAging({ asOf: "2026-06-30" }));

    expect(aging.asOf).toBe("2026-06-30");
    expect(aging.rows).toHaveLength(1);
    const row = aging.rows[0]!;
    expect(row).toMatchObject({
      studentId: STUDENT,
      studentName: "Amina Student",
      invoiceCount: 3,
      // A is 180 days overdue (late fee included), C is not yet due.
      d90_plus: 1050,
      d1_30: 400,
      current: 300,
      d31_60: 0,
      d61_90: 0,
      total: 1750,
    });
    expect(aging.totals).toMatchObject({
      d90_plus: 1050,
      d1_30: 400,
      current: 300,
      total: 1750,
      invoiceCount: 3,
    });
    expect(aging.totalStudents).toBe(1);
    expect(aging.hasMore).toBe(false);
  });

  it("moves the whole balance into 90+ as the as-of date advances", async () => {
    const later = await runWithTenant(TENANT, () => loadReceivablesAging({ asOf: "2027-06-30" }));
    expect(later.rows[0]).toMatchObject({
      current: 0,
      d1_30: 0,
      d31_60: 0,
      d61_90: 0,
      d90_plus: 1750,
      total: 1750,
    });
  });
});
