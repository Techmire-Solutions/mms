import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeDatabaseConnection,
  pingDatabase,
  closeDatabase,
  beginLongLivedTenantTransaction,
  withActiveTransaction,
} from "../../db/dbConnection.js";
import {
  workspaces,
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  accountingEntryTags,
  accountingEntryAttachments,
} from "../../db/schema.js";
import { aggregateAccountingReport } from "../../db/repositories/accountingRepositoryReport.js";

const TEST_SUBDOMAIN = "report-aggregates-accounting";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function applyDatabaseUrlFromEnvFile(): void {
  if (process.env.DATABASE_URL) return;
  try {
    const content = readFileSync(join(backendRoot, ".env"), "utf-8");
    const match = content.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?$/m);
    if (match) process.env.DATABASE_URL = match[1].trim();
  } catch {
    // no .env present — loadServerConfig will use its test default
  }
}

let dbAvailable = false;

const ACCOUNTS = [
  { id: "acc-cash", code: "1000", name: "Cash", type: "Asset", subtype: "Current" },
  { id: "acc-ar", code: "1100", name: "Accounts Receivable", type: "Asset", subtype: "Current" },
  { id: "acc-buildings", code: "1500", name: "Buildings", type: "Asset", subtype: "Fixed" },
  { id: "acc-ap", code: "2000", name: "Accounts Payable", type: "Liability", subtype: "Payable" },
  { id: "acc-capital", code: "3000", name: "Capital", type: "Equity", subtype: "" },
  { id: "acc-fees", code: "4000", name: "Tuition Fees", type: "Revenue", subtype: "" },
  { id: "acc-salaries", code: "5000", name: "Salaries", type: "Expense", subtype: "" },
  { id: "acc-dep", code: "5100", name: "Depreciation Expense", type: "Expense", subtype: "" },
];

/** [entryId, date, [accountId, debit, credit][]] — every entry balances. */
const ENTRIES: [string, string, [string, number, number][]][] = [
  // Prior period: an asset acquired before any requested window. A Balance Sheet
  // filtered by a start date used to drop it entirely.
  [
    "e-prior",
    "2024-06-01",
    [
      ["acc-buildings", 10000, 0],
      ["acc-capital", 0, 10000],
    ],
  ],
  // Fee collected in cash.
  [
    "e-fee-cash",
    "2026-03-01",
    [
      ["acc-cash", 500, 0],
      ["acc-fees", 0, 500],
    ],
  ],
  // Fee invoiced on credit — revenue without cash.
  [
    "e-fee-ar",
    "2026-03-15",
    [
      ["acc-ar", 1000, 0],
      ["acc-fees", 0, 1000],
    ],
  ],
  // Salary paid in cash.
  [
    "e-sal-cash",
    "2026-04-01",
    [
      ["acc-salaries", 200, 0],
      ["acc-cash", 0, 200],
    ],
  ],
  // Salary accrued, not yet paid.
  [
    "e-sal-ap",
    "2026-04-15",
    [
      ["acc-salaries", 300, 0],
      ["acc-ap", 0, 300],
    ],
  ],
  // Non-cash expense.
  [
    "e-dep",
    "2026-05-01",
    [
      ["acc-dep", 100, 0],
      ["acc-buildings", 0, 100],
    ],
  ],
];

async function purge(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null);
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx
      .delete(accountingEntryAttachments)
      .where(eq(accountingEntryAttachments.workspaceSubdomain, TEST_SUBDOMAIN));
    await tx.tx
      .delete(accountingEntryTags)
      .where(eq(accountingEntryTags.workspaceSubdomain, TEST_SUBDOMAIN));
    await tx.tx
      .delete(accountingJournalLines)
      .where(eq(accountingJournalLines.workspaceSubdomain, TEST_SUBDOMAIN));
    await tx.tx
      .delete(accountingEntries)
      .where(eq(accountingEntries.workspaceSubdomain, TEST_SUBDOMAIN));
    await tx.tx
      .delete(accountingAccounts)
      .where(eq(accountingAccounts.workspaceSubdomain, TEST_SUBDOMAIN));
    await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

beforeAll(async () => {
  applyDatabaseUrlFromEnvFile();
  initializeDatabaseConnection();
  dbAvailable = await pingDatabase();
  if (!dbAvailable) return;

  await purge().catch(() => undefined);

  const seedTx = await beginLongLivedTenantTransaction(null);
  try {
    await seedTx.tx.insert(workspaces).values({
      id: "ws-report-aggregates-accounting",
      subdomain: TEST_SUBDOMAIN,
      madrasaName: "Report Aggregates Accounting",
      enabled: true,
    });
    await seedTx.tx.insert(accountingAccounts).values(
      ACCOUNTS.map((account) => ({
        ...account,
        workspaceSubdomain: TEST_SUBDOMAIN,
        description: "",
        isActive: true,
      })),
    );
    await seedTx.tx.insert(accountingEntries).values(
      ENTRIES.map(([id, date]) => ({
        id,
        workspaceSubdomain: TEST_SUBDOMAIN,
        date,
        ref: id,
        description: id,
        status: "posted",
        createdBy: "u1",
        fiscalYear: "",
      })),
    );
    await seedTx.tx.insert(accountingJournalLines).values(
      ENTRIES.flatMap(([entryId, , lines]) =>
        lines.map(([accountId, debit, credit], index) => ({
          id: `${entryId}-l${index}`,
          workspaceSubdomain: TEST_SUBDOMAIN,
          entryId,
          accountId,
          debit: String(debit),
          credit: String(credit),
          description: "",
        })),
      ),
    );
    await seedTx.commit();
  } catch (error) {
    await seedTx.rollback().catch(() => undefined);
    throw error;
  }
});

afterAll(async () => {
  if (dbAvailable) await purge().catch(() => undefined);
  await closeDatabase().catch(() => undefined);
});

const WINDOW = { dateFrom: "2026-01-01", dateTo: "2026-12-31" };

describe.skipIf(!process.env.DATABASE_URL && false)(
  "aggregateAccountingReport (real Postgres)",
  () => {
    it("keeps income and cash-flow figures after closing while the trial balance includes the close", async () => {
      expect(dbAvailable, "PostgreSQL is required for the closing-report regression").toBe(true);
      const tx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
      try {
        await tx.tx.insert(accountingEntries).values({
          id: "e-closing",
          workspaceSubdomain: TEST_SUBDOMAIN,
          date: "2026-12-31",
          ref: "closing",
          description: "Close year",
          status: "posted",
          sourceType: "closing",
        });
        await tx.tx.insert(accountingJournalLines).values(
          [
            { id: "close-revenue", accountId: "acc-fees", debit: "1500", credit: "0" },
            { id: "close-salaries", accountId: "acc-salaries", debit: "0", credit: "500" },
            { id: "close-depreciation", accountId: "acc-dep", debit: "0", credit: "100" },
            { id: "close-equity", accountId: "acc-capital", debit: "0", credit: "900" },
          ].map((line) => ({ ...line, workspaceSubdomain: TEST_SUBDOMAIN, entryId: "e-closing" })),
        );
        await withActiveTransaction(tx.tx, async () => {
          for (const query of [WINDOW, {}]) {
            const report = await aggregateAccountingReport(TEST_SUBDOMAIN, query);
            expect(report.revenue).toBe(1500);
            expect(report.expenses).toBe(600);
            expect(report.netSurplus).toBe(900);
            expect(report.netCashFlowIndirect).toBe(300);
            expect(report.netCashFlow).toBe(300);
            expect(report.trialBalance.find((row) => row.id === "acc-fees")?.balance).toBe(0);
            expect(
              report.incomeStatementTrialBalance?.find((row) => row.id === "acc-fees")?.balance,
            ).toBe(1500);
            expect(report.equity).toBe(10900);
            expect(
              report.balanceSheetTrialBalance.find((row) => row.id === "acc-capital")?.balance,
            ).toBe(10900);
            expect(report.assets).toBe(report.liabilities + report.equity);
          }
        });
      } finally {
        await tx.rollback();
      }
    });
    it("reports range flows and cumulative stock figures side by side", async () => {
      if (!dbAvailable) return;

      const report = await aggregateAccountingReport(TEST_SUBDOMAIN, WINDOW);

      // Flow figures cover the requested window.
      expect(report.revenue).toBe(1500);
      expect(report.expenses).toBe(600);
      expect(report.netSurplus).toBe(900);

      // Stock figures are cumulative through dateTo, so the prior-period building
      // (10000, less 100 of depreciation) is present even though dateFrom excludes it.
      expect(report.assets).toBe(11200);
      expect(report.liabilities).toBe(300);
      expect(report.equity).toBe(10900);
      expect(report.assets).toBe(report.liabilities + report.equity);

      // The range row set stays a movement statement — the building shows only this
      // window's depreciation — which is exactly why a Balance Sheet cannot be
      // built from it.
      const rangeBuildings = report.trialBalance.find((row) => row.id === "acc-buildings");
      expect(rangeBuildings?.balance).toBe(-100);
      const asOfBuildings = report.balanceSheetTrialBalance.find(
        (row) => row.id === "acc-buildings",
      );
      expect(asOfBuildings?.balance).toBe(9900);

      // The balance-sheet row set carries stock accounts only.
      expect(report.balanceSheetTrialBalance.map((row) => row.type).sort()).toEqual([
        "Asset",
        "Asset",
        "Asset",
        "Equity",
        "Liability",
      ]);
    });

    it("reconciles the indirect cash-flow build-up with the direct cash movement", async () => {
      if (!dbAvailable) return;

      const report = await aggregateAccountingReport(TEST_SUBDOMAIN, WINDOW);

      expect(report.cashInflow).toBe(500);
      expect(report.cashOutflow).toBe(200);
      expect(report.netCashFlow).toBe(300);

      // Classified from account subtype/name, with no hard-coded chart-of-accounts codes.
      expect(report.cashFlowAdjustments.depreciation).toBe(100);
      expect(report.cashFlowAdjustments.receivables).toBe(-1000);
      expect(report.cashFlowAdjustments.payables).toBe(300);

      // netSurplus + depreciation − ΔAR + ΔAP must equal the actual cash movement;
      // this is the check the panel previously could not satisfy.
      expect(report.netCashFlowIndirect).toBe(report.netCashFlow);
    });

    it("lets configured posting-rule accounts override the name heuristics", async () => {
      if (!dbAvailable) return;

      // 'acc-buildings' is neither coded nor named like cash or a receivable, yet an
      // explicit rule makes it the authority for both roles.
      const report = await aggregateAccountingReport(TEST_SUBDOMAIN, {
        ...WINDOW,
        postingRules: { cashAccountId: "acc-buildings", arAccountId: "acc-buildings" },
      });

      // Cash classification is additive with the heuristic (a workspace may bank in
      // several accounts while the rule holds only one), so the Cash account still
      // counts alongside the configured Buildings account.
      expect(report.cashInflow).toBe(500); // Cash debits in the window
      expect(report.cashOutflow).toBe(300); // Cash 200 + Buildings depreciation 100
      expect(report.netCashFlow).toBe(200);

      // The configured AR account is authoritative and exclusive: the real
      // Accounts Receivable movement (1000 debit) must NOT also be counted, so the
      // adjustment reflects the Buildings movement only.
      expect(report.cashFlowAdjustments.receivables).toBe(100);
    });

    it("ignores drafts, deleted rows and out-of-window entries", async () => {
      if (!dbAvailable) return;

      const tx = await beginLongLivedTenantTransaction(null);
      try {
        await tx.tx.insert(accountingEntries).values({
          id: "e-draft",
          workspaceSubdomain: TEST_SUBDOMAIN,
          date: "2026-07-01",
          ref: "draft",
          description: "draft",
          status: "draft",
          createdBy: "u1",
          fiscalYear: "",
        });
        await tx.tx.insert(accountingJournalLines).values([
          {
            id: "e-draft-l0",
            workspaceSubdomain: TEST_SUBDOMAIN,
            entryId: "e-draft",
            accountId: "acc-cash",
            debit: "9999",
            credit: "0",
            description: "",
          },
          {
            id: "e-draft-l1",
            workspaceSubdomain: TEST_SUBDOMAIN,
            entryId: "e-draft",
            accountId: "acc-fees",
            debit: "0",
            credit: "9999",
            description: "",
          },
        ]);
        await tx.commit();
      } catch (error) {
        await tx.rollback().catch(() => undefined);
        throw error;
      }

      const report = await aggregateAccountingReport(TEST_SUBDOMAIN, WINDOW);
      expect(report.revenue).toBe(1500);
      expect(report.netCashFlow).toBe(300);
      expect(report.assets).toBe(11200);
    });
  },
);
