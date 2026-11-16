import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import {
  workspaces,
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  accountingBankStatements,
  accountingBankStatementLines,
} from "../../db/schema.js";
import {
  matchBankReconciliation,
  saveBankStatement,
} from "../../db/repositories/accountingBankingRepository.js";
import { requireDatabaseConnection, uniqueTenant } from "./dbTestSupport.js";

/**
 * Bank reconciliation matching: one statement line consumes one journal line, a
 * replay is idempotent, and a double-consumption is a 409 — backed by the
 * `accounting_bank_reconciliations_journal_line_uidx` index, not just application
 * guards.
 */
const TEST_SUBDOMAIN = uniqueTenant("accounting-banking");

beforeAll(async () => {
  await requireDatabaseConnection();
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
  await tx.tx.insert(workspaces).values({
    id: `ws-${TEST_SUBDOMAIN}`,
    subdomain: TEST_SUBDOMAIN,
    madrasaName: "Banking test",
    enabled: true,
  });
  await tx.tx.insert(accountingAccounts).values([
    {
      id: "acc-bank",
      workspaceSubdomain: TEST_SUBDOMAIN,
      code: "10100",
      name: "Bank",
      type: "Asset",
    },
    {
      id: "acc-cash",
      workspaceSubdomain: TEST_SUBDOMAIN,
      code: "10200",
      name: "Cash",
      type: "Asset",
    },
  ]);
  await tx.tx.insert(accountingBankStatements).values({
    id: "bs-1",
    workspaceSubdomain: TEST_SUBDOMAIN,
    accountId: "acc-bank",
    periodStart: "2026-11-01",
    periodEnd: "2026-11-30",
    openingBalance: "0",
    closingBalance: "100",
  });
  await tx.tx.insert(accountingBankStatementLines).values([
    {
      id: "bsl-1",
      workspaceSubdomain: TEST_SUBDOMAIN,
      statementId: "bs-1",
      date: "2026-11-05",
      description: "Deposit",
      amount: "100",
    },
    {
      id: "bsl-2",
      workspaceSubdomain: TEST_SUBDOMAIN,
      statementId: "bs-1",
      date: "2026-11-06",
      description: "Withdrawal",
      amount: "-100",
    },
  ]);
  await tx.tx.insert(accountingEntries).values({
    id: "je-1",
    workspaceSubdomain: TEST_SUBDOMAIN,
    date: "2026-11-05",
    ref: "JE-1",
    description: "Transfer",
    status: "posted",
    createdBy: "u1",
    fiscalYear: "",
    sourceType: "manual",
  });
  await tx.tx.insert(accountingJournalLines).values([
    {
      id: "jl-bank",
      workspaceSubdomain: TEST_SUBDOMAIN,
      entryId: "je-1",
      accountId: "acc-bank",
      debit: "100",
      credit: "0",
      description: "",
    },
    {
      id: "jl-cash",
      workspaceSubdomain: TEST_SUBDOMAIN,
      entryId: "je-1",
      accountId: "acc-cash",
      debit: "0",
      credit: "100",
      description: "",
    },
  ]);
  await tx.commit();
});

afterAll(async () => {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
  await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
  await tx.commit();
  await closeDatabase();
});

const match = (statementLineId: string, journalEntryId: string, journalLineId: string) =>
  matchBankReconciliation(
    TEST_SUBDOMAIN,
    { statementLineId, journalEntryId, journalLineId },
    "test",
  );

describe("bank reconciliation matching", () => {
  it("matches a statement line once and replays idempotently", async () => {
    await expect(match("bsl-1", "je-1", "jl-bank")).resolves.toBeUndefined();
    await expect(match("bsl-1", "je-1", "jl-bank")).resolves.toBeUndefined();
  });

  it("refuses to point an already-matched statement line at a different journal line", async () => {
    await expect(match("bsl-1", "je-1", "jl-cash")).rejects.toMatchObject({
      statusCode: 409,
      type: "bank_line_already_matched",
    });
  });

  it("refuses to consume the same journal line against another statement line", async () => {
    await expect(match("bsl-2", "je-1", "jl-bank")).rejects.toMatchObject({
      statusCode: 409,
      type: "journal_line_already_matched",
    });
  });

  it("rejects re-importing a reconciled statement with changed content", async () => {
    // `bsl-1` is matched by the first test, so re-saving `bs-1` with a different
    // closing balance must refuse rather than delete-and-reinsert its lines and
    // orphan the match row.
    await expect(
      saveBankStatement(TEST_SUBDOMAIN, {
        id: "bs-1",
        accountId: "acc-bank",
        periodStart: "2026-11-01",
        periodEnd: "2026-11-30",
        openingBalance: 0,
        closingBalance: 200,
        lines: [
          { id: "bsl-1", date: "2026-11-05", description: "Deposit", amount: 100 },
          { id: "bsl-2", date: "2026-11-06", description: "Withdrawal", amount: -100 },
        ],
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "bank_statement_reconciled" });
  });
});
