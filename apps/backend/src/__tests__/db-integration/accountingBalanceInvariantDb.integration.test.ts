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
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * The double-entry invariant must hold at the database, not only in
 * `prepareJournalEntryForPersist`: backup restore, the legacy import, the IAS 21
 * backfill and any future repository caller write journal lines without going
 * through that guard. Migration 0249 adds commit-time (deferred) constraint
 * triggers, so an unbalanced *posted* entry cannot be committed by any path.
 */
const TENANT = "accounting-balance-invariant";

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

/**
 * Drizzle wraps driver errors and a deferred-trigger failure surfaces from the
 * COMMIT, so assert the guard text wherever it lives (message or cause).
 */
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

interface RawLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  funcDebit?: string | null;
  funcCredit?: string | null;
}

/** Writes an entry and its lines like a restore/import path would: no app guard. */
async function insertRawEntry(
  entry: { id: string; status: "posted" | "draft"; date?: string },
  lines: RawLine[],
  options?: { allowHardPurge?: boolean },
): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    if (options?.allowHardPurge) {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    }
    await tx.insert(accountingEntries).values({
      id: entry.id,
      workspaceSubdomain: TENANT,
      date: entry.date ?? "2026-05-01",
      ref: `REF-${entry.id}`,
      description: "raw",
      status: entry.status,
      createdBy: "test",
      fiscalYear: "",
    });
    if (lines.length > 0) {
      await tx.insert(accountingJournalLines).values(
        lines.map((line) => ({
          id: line.id,
          workspaceSubdomain: TENANT,
          entryId: entry.id,
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          funcDebit: line.funcDebit === undefined ? line.debit : line.funcDebit,
          funcCredit: line.funcCredit === undefined ? line.credit : line.funcCredit,
          description: "",
        })),
      );
    }
  });
}

const balanced = (tag: string): RawLine[] => [
  { id: `${tag}-d`, accountId: "acc-cash", debit: "100.00", credit: "0" },
  { id: `${tag}-c`, accountId: "acc-income", debit: "0", credit: "100.00" },
];

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Balance invariant", enabled: true });
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
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("posted journal entries must balance at commit (Postgres)", () => {
  it("commits a balanced posted entry", async () => {
    await insertRawEntry({ id: "e-balanced", status: "posted" }, balanced("bal"));
    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: accountingJournalLines.id })
        .from(accountingJournalLines)
        .where(eq(accountingJournalLines.entryId, "e-balanced")),
    );
    expect(rows).toHaveLength(2);
  });

  it("rejects an unbalanced posted entry at commit, whatever wrote it", async () => {
    await expectGuardFailure(
      insertRawEntry({ id: "e-unbalanced", status: "posted" }, [
        { id: "u-d", accountId: "acc-cash", debit: "100.00", credit: "0" },
        { id: "u-c", accountId: "acc-income", debit: "0", credit: "90.00" },
      ]),
      /balanced|debit vs .* credit/i,
    );
  });

  it("allows an unbalanced draft", async () => {
    await insertRawEntry({ id: "e-draft", status: "draft" }, [
      { id: "d-d", accountId: "acc-cash", debit: "100.00", credit: "0" },
      { id: "d-c", accountId: "acc-income", debit: "0", credit: "90.00" },
    ]);
  });

  it("rejects posting a draft that has no lines", async () => {
    await insertRawEntry({ id: "e-empty", status: "draft" }, []);
    await expectGuardFailure(
      withTenant(TENANT, (tx) =>
        tx
          .update(accountingEntries)
          .set({ status: "posted" })
          .where(eq(accountingEntries.id, "e-empty")),
      ),
      /at least two lines/i,
    );
  });

  it("rejects a posted entry whose functional amount does not mirror the ledger amount", async () => {
    await expect(
      insertRawEntry({ id: "e-func-mismatch", status: "posted" }, [
        { id: "f-d", accountId: "acc-cash", debit: "100.00", credit: "0", funcDebit: "90.00" },
        { id: "f-c", accountId: "acc-income", debit: "0", credit: "100.00" },
      ]),
    ).rejects.toThrow();
  });

  it("keeps the maintenance escape the restore and purge paths use", async () => {
    // A backup restore may carry the rows it was given; it runs under the flag.
    await insertRawEntry(
      { id: "e-restored", status: "posted" },
      [
        { id: "r-d", accountId: "acc-cash", debit: "100.00", credit: "0" },
        { id: "r-c", accountId: "acc-income", debit: "0", credit: "90.00" },
      ],
      { allowHardPurge: true },
    );
  });
});

describe("posted content is immutable at the database (0249)", () => {
  it("rejects changing the ledger columns of a posted entry", async () => {
    await expectGuardFailure(
      withTenant(TENANT, (tx) =>
        tx
          .update(accountingEntries)
          .set({ date: "2026-06-01" })
          .where(eq(accountingEntries.id, "e-balanced")),
      ),
      /immutable/,
    );
  });

  it("rejects changing the amount or account of a posted line", async () => {
    await expectGuardFailure(
      withTenant(TENANT, (tx) =>
        tx
          .update(accountingJournalLines)
          .set({ debit: "200.00" })
          .where(eq(accountingJournalLines.id, "bal-d")),
      ),
      /immutable/,
    );
  });

  it("still allows an in-place IAS 21 backfill of a posted line", async () => {
    // 091_backfill_functional_currency fills txn_*/rate_* on rows that are already
    // posted; the guard must keep that contract.
    await withTenant(TENANT, (tx) =>
      tx
        .update(accountingJournalLines)
        .set({ txnDebit: "55.00", txnCredit: "0", exchangeRate: "1.8181818182" })
        .where(eq(accountingJournalLines.id, "bal-d")),
    );
  });
});
