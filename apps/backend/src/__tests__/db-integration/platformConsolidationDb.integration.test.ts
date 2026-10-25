import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import type { JournalEntry, JournalLine } from "@mms/shared";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import {
  accountingAccounts,
  accountingCurrencySettings,
  accountingEntries,
  accountingJournalLines,
  consolidationGroups,
  workspaces,
} from "../../db/schema.js";
import { bulkSaveEntries } from "../../db/repositories/accountingEntriesPersist.js";
import { platformConsolidationRepository as repo } from "../../platform/repository/platformConsolidationRepositoryAdapter.js";
import {
  buildConsolidationReport,
  saveGroup,
} from "../../platform/use-cases/consolidationUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const PARENT = "fx-ias21-parent";
const SUB = "fx-ias21-sub";
const GROUP = "grp-ias21-test";

async function cleanup(): Promise<void> {
  const { tx, commit, rollback } = await beginLongLivedTenantTransaction(null);
  try {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(consolidationGroups).where(eq(consolidationGroups.id, GROUP));
    for (const table of [
      accountingJournalLines,
      accountingEntries,
      accountingAccounts,
      accountingCurrencySettings,
    ]) {
      await tx.delete(table).where(inArray(table.workspaceSubdomain, [PARENT, SUB]));
    }
    await tx.delete(workspaces).where(inArray(workspaces.subdomain, [PARENT, SUB]));
    await commit();
  } catch (error) {
    await rollback().catch(() => undefined);
    throw error;
  }
}

const line = (id: string, account: string, debit: number, credit: number): JournalLine => ({
  id,
  account_id: account,
  debit,
  credit,
  description: "",
});

const entry = (id: string, date: string, lines: JournalLine[]): JournalEntry =>
  ({
    id,
    date,
    ref: id,
    description: "",
    status: "posted",
    created_by: "t",
    tags: [],
    attachments: [],
    fiscal_year: "",
    lines,
  }) as JournalEntry;

const chart = (tenant: string) => [
  { id: "cash", workspaceSubdomain: tenant, code: "1000", name: "Cash", type: "Asset" },
  {
    id: "due-from",
    workspaceSubdomain: tenant,
    code: "1500",
    name: "Due from subsidiary",
    type: "Asset",
  },
  {
    id: "due-to",
    workspaceSubdomain: tenant,
    code: "2500",
    name: "Due to parent",
    type: "Liability",
  },
  {
    id: "capital",
    workspaceSubdomain: tenant,
    code: "3000",
    name: "Share capital",
    type: "Equity",
  },
  { id: "income", workspaceSubdomain: tenant, code: "4000", name: "Fee income", type: "Revenue" },
  { id: "salaries", workspaceSubdomain: tenant, code: "5000", name: "Salaries", type: "Expense" },
];

beforeAll(async () => {
  await requireDatabaseConnection();
  await cleanup();
  const { tx, commit } = await beginLongLivedTenantTransaction(null);
  for (const tenant of [PARENT, SUB]) {
    await tx
      .insert(workspaces)
      .values({ id: `ws-${tenant}`, subdomain: tenant, madrasaName: tenant, enabled: true });
    await tx.insert(accountingAccounts).values(chart(tenant));
  }
  await tx.insert(accountingCurrencySettings).values([
    { workspaceSubdomain: PARENT, functionalCurrency: "PKR", presentationCurrency: "PKR" },
    { workspaceSubdomain: SUB, functionalCurrency: "USD", presentationCurrency: "USD" },
  ]);
  await commit();
  // Parent (PKR): capital 52,800 → cash 50,000 + 2,800 lent to the subsidiary.
  await bulkSaveEntries(PARENT, [
    entry("p1", "2026-01-01", [
      line("a", "cash", 50000, 0),
      line("b", "due-from", 2800, 0),
      line("c", "capital", 0, 52800),
    ]),
  ]);
  // Subsidiary (USD): capital 80, borrowed 10 from the parent, earned 50, paid 30 salaries.
  await bulkSaveEntries(SUB, [
    entry("s1", "2026-01-01", [
      line("a", "cash", 90, 0),
      line("b", "capital", 0, 80),
      line("c", "due-to", 0, 10),
    ]),
    entry("s2", "2026-06-01", [line("a", "cash", 50, 0), line("b", "income", 0, 50)]),
    entry("s3", "2026-06-15", [line("a", "salaries", 30, 0), line("b", "cash", 0, 30)]),
  ]);
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

describe("platform consolidation", () => {
  it("given a PKR parent and an 80% USD subsidiary, should translate, eliminate intercompany and balance", async () => {
    // Arrange
    await saveGroup(repo, { id: "admin", email: "admin@test.local" }, GROUP, {
      name: "Test group",
      presentationCurrency: "PKR",
      intercompanyAccountCodes: ["1500", "2500"],
      members: [
        { memberSubdomain: PARENT, ownershipPercent: 100, isParent: true },
        {
          memberSubdomain: SUB,
          ownershipPercent: 80,
          isParent: false,
          closingRate: "280",
          averageRate: "278",
          historicalRate: "270",
        },
      ],
    });

    // Act
    const report = await buildConsolidationReport(repo, GROUP, {
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });

    // Assert
    const sub = report.members.find((member) => member.memberSubdomain === SUB);
    expect(sub?.functionalCurrency).toBe("USD");
    expect(sub?.rows.find((row) => row.code === "1000")).toMatchObject({
      functionalBalance: 110,
      balance: 30800,
    });
    const row = (code: string) => report.consolidated.rows.find((r) => r.code === code);
    expect(row("1000")?.balance).toBe(80800);
    expect(row("1500")?.balance).toBe(0);
    expect(row("2500")?.balance).toBe(0);
    expect(report.consolidated.cta).toBe(840);
    expect(report.consolidated.nonControllingInterest).toBe(5600);
    expect(report.consolidated.totals.debit).toBe(report.consolidated.totals.credit);
  });

  it("given a foreign member without translation rates, should refuse with 422", async () => {
    // Arrange
    await saveGroup(repo, { id: "admin", email: "admin@test.local" }, GROUP, {
      name: "Test group",
      presentationCurrency: "PKR",
      intercompanyAccountCodes: [],
      members: [
        { memberSubdomain: PARENT, ownershipPercent: 100, isParent: true },
        { memberSubdomain: SUB, ownershipPercent: 100, isParent: false },
      ],
    });

    // Act
    const result = buildConsolidationReport(repo, GROUP, {
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });

    // Assert
    await expect(result).rejects.toMatchObject({ statusCode: 422 });
  });
});
