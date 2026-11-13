import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import {
  workspaces,
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  accountingModulePreferences,
  accountingPostingRules,
} from "../../db/schema.js";
import {
  bulkSaveAccounts,
  bulkRestoreAccounts,
  bulkSoftDeleteAccounts,
} from "../../db/repositories/accountingAccountsPersist.js";
import { listAccountsByWorkspace } from "../../db/repositories/accountingAccountsRepository.js";
import { requireDatabaseConnection, uniqueTenant, extractPgErrorCode } from "./dbTestSupport.js";
import type { Account } from "@mms/shared";

/**
 * 0253: chart-of-accounts hierarchy, code uniqueness, archive guards, restore
 * attribution and optimistic concurrency, verified against real PostgreSQL.
 *
 * The triggers are the point of this suite: an application guard that only lives
 * in a repository can be bypassed by any new writer, an import or an ops script.
 */
const TEST_SUBDOMAIN = uniqueTenant("accounting-accounts-schema");

const account = (id: string, code: string, extra: Partial<Account> = {}): Account => ({
  id,
  code,
  name: `Account ${id}`,
  type: "Asset",
  subtype: "",
  description: "",
  isActive: true,
  ...extra,
});

async function purgeWorkspace(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx
      .delete(accountingModulePreferences)
      .where(eq(accountingModulePreferences.workspaceSubdomain, TEST_SUBDOMAIN));
    await tx.tx
      .delete(accountingPostingRules)
      .where(eq(accountingPostingRules.workspaceSubdomain, TEST_SUBDOMAIN));
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
  } catch {
    await tx.rollback().catch(() => undefined);
  }
}

/** Inserts through the trigger, returning the PostgreSQL error code (or undefined on success). */
async function insertAccountRaw(
  id: string,
  code: string,
  parentAccountId: string | null,
): Promise<string | undefined> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.insert(accountingAccounts).values({
      id,
      workspaceSubdomain: TEST_SUBDOMAIN,
      code,
      name: `Account ${id}`,
      type: "Asset",
      parentAccountId,
    });
    await tx.commit();
    return undefined;
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    return extractPgErrorCode(error);
  }
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await purgeWorkspace();

  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.insert(workspaces).values({
      id: `ws-${TEST_SUBDOMAIN}`,
      subdomain: TEST_SUBDOMAIN,
      madrasaName: "Accounts Schema",
      enabled: true,
    });
    await tx.tx.insert(accountingAccounts).values([
      {
        id: "acc-root",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "1000",
        name: "Assets",
        type: "Asset",
      },
      {
        id: "acc-child",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "1100",
        name: "Cash",
        type: "Asset",
        parentAccountId: "acc-root",
      },
      {
        id: "acc-cash",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "1110",
        name: "Cash on hand",
        type: "Asset",
        parentAccountId: "acc-child",
      },
      {
        id: "acc-income",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "4000",
        name: "Fees",
        type: "Revenue",
      },
      {
        id: "acc-earmarked",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "1200",
        name: "Barely used",
        type: "Asset",
      },
      {
        id: "acc-free",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "1400",
        name: "Spare",
        type: "Asset",
      },
      {
        id: "acc-retained",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "1500",
        name: "Retained earnings",
        type: "Equity",
      },
      {
        id: "acc-archived-parent",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "1300",
        name: "Closed branch",
        type: "Asset",
        deletedAt: new Date(),
        deletedBy: "tester",
        deletionReason: "closed branch",
      },
    ]);
    await tx.tx.insert(accountingPostingRules).values({
      workspaceSubdomain: TEST_SUBDOMAIN,
      cashAccountId: "acc-cash",
      updatedAt: new Date(),
    });
    await tx.tx.insert(accountingModulePreferences).values({
      workspaceSubdomain: TEST_SUBDOMAIN,
      preferences: { retainedEarningsAccountId: "acc-retained" },
      updatedAt: new Date(),
    });

    // A posted entry carrying a line on `acc-earmarked` (balanced, so the 0249
    // commit-time guard accepts it) and a draft entry pointing at a free account.
    await tx.tx.insert(accountingEntries).values([
      {
        id: "entry-posted",
        workspaceSubdomain: TEST_SUBDOMAIN,
        date: "2026-01-10",
        ref: "JE-POSTED-1",
        status: "posted",
        createdBy: "tester",
        fiscalYear: "FY2026",
      },
      {
        id: "entry-draft",
        workspaceSubdomain: TEST_SUBDOMAIN,
        date: "2026-01-11",
        ref: "JE-DRAFT-1",
        status: "draft",
        createdBy: "tester",
        fiscalYear: "FY2026",
      },
    ]);
    await tx.tx.insert(accountingJournalLines).values([
      {
        id: "line-1",
        workspaceSubdomain: TEST_SUBDOMAIN,
        entryId: "entry-posted",
        accountId: "acc-earmarked",
        debit: "100.00",
        credit: "0",
      },
      {
        id: "line-2",
        workspaceSubdomain: TEST_SUBDOMAIN,
        entryId: "entry-posted",
        accountId: "acc-income",
        debit: "0",
        credit: "100.00",
      },
      {
        id: "line-3",
        workspaceSubdomain: TEST_SUBDOMAIN,
        entryId: "entry-draft",
        accountId: "acc-free",
        debit: "5.00",
        credit: "0",
      },
    ]);
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
});

afterAll(async () => {
  await purgeWorkspace();
  await closeDatabase();
});

describe("chart-of-accounts hierarchy (0253)", () => {
  it("persists a parent link and returns it through the reader", async () => {
    const accounts = await listAccountsByWorkspace(TEST_SUBDOMAIN);
    expect(accounts.find((row) => row.id === "acc-child")?.parentId).toBe("acc-root");
    expect(accounts.find((row) => row.id === "acc-root")?.parentId).toBeNull();
  });

  it("rejects an account as its own parent", async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    const error = await tx.tx
      .execute(sql`UPDATE accounting_accounts SET parent_account_id = id WHERE id = 'acc-root'`)
      .then(() => undefined)
      .catch((err: unknown) => err);
    await tx.rollback().catch(() => undefined);
    expect(extractPgErrorCode(error)).toBe("23514");
  });

  it("rejects a reparent that would close a cycle, even through raw SQL", async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    const error = await tx.tx
      .execute(
        sql`UPDATE accounting_accounts SET parent_account_id = 'acc-cash' WHERE id = 'acc-root'`,
      )
      .then(() => undefined)
      .catch((err: unknown) => err);
    await tx.rollback().catch(() => undefined);
    expect(extractPgErrorCode(error)).toBe("23514");
  });

  it("rejects a chain deeper than the documented maximum", async () => {
    // acc-root -> acc-child -> acc-cash is 2 levels; extend to the limit and past it.
    let parent = "acc-cash";
    for (let level = 3; level <= 8; level += 1) {
      const id = `deep-${level}`;
      expect(await insertAccountRaw(id, `9${level}0`, parent)).toBeUndefined();
      parent = id;
    }
    // `parent` now sits at depth 8; one more is rejected.
    expect(await insertAccountRaw("deep-9", "9900", parent)).toBe("23514");
  });

  it("rejects a parent from another workspace (composite FK)", async () => {
    const other = uniqueTenant("accounting-accounts-other");
    const seed = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    await seed.tx.insert(workspaces).values({
      id: `ws-${other}`,
      subdomain: other,
      madrasaName: "Other",
      enabled: true,
    });
    await seed.tx.insert(accountingAccounts).values({
      id: "other-root",
      workspaceSubdomain: other,
      code: "1000",
      name: "Other root",
      type: "Asset",
    });
    await seed.commit();

    const attempt = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    const error = await attempt.tx
      .execute(
        sql`UPDATE accounting_accounts SET parent_account_id = 'other-root' WHERE id = 'acc-income'`,
      )
      .then(() => undefined)
      .catch((err: unknown) => err);
    await attempt.rollback().catch(() => undefined);
    expect(extractPgErrorCode(error)).toBe("23503");

    const cleanup = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    await cleanup.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await cleanup.tx
      .delete(accountingAccounts)
      .where(eq(accountingAccounts.workspaceSubdomain, other));
    await cleanup.tx.delete(workspaces).where(eq(workspaces.subdomain, other));
    await cleanup.commit();
  });

  it("refuses a cycle through the application guard with a 422", async () => {
    await expect(
      bulkSaveAccounts(TEST_SUBDOMAIN, [account("acc-root", "1000", { parentId: "acc-cash" })]),
    ).rejects.toMatchObject({ statusCode: 422, type: "account_hierarchy_invalid" });
  });

  it("refuses nesting under an archived parent with a 422", async () => {
    await expect(
      bulkSaveAccounts(TEST_SUBDOMAIN, [
        account("acc-income", "4000", { parentId: "acc-archived-parent" }),
      ]),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe("account code uniqueness (0253)", () => {
  it("rejects a second active account with the same code", async () => {
    await expect(
      bulkSaveAccounts(TEST_SUBDOMAIN, [account("acc-dupe-code", "1000")]),
    ).rejects.toMatchObject({ statusCode: 409, type: "account_code_conflict" });
  });

  it("allows a trashed account to keep a code an active account now uses", async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    await tx.tx.insert(accountingAccounts).values({
      id: "acc-trashed-code",
      workspaceSubdomain: TEST_SUBDOMAIN,
      code: "7777",
      name: "Trashed",
      type: "Asset",
      deletedAt: new Date(),
      deletedBy: "tester",
    });
    await tx.commit();
    // `acc-trashed-code` holds 7777 while trashed; a new active account may take it.
    await expect(
      bulkSaveAccounts(TEST_SUBDOMAIN, [account("acc-new-7777", "7777")]),
    ).resolves.toBeUndefined();
    // Restoring the trashed one now conflicts on the code.
    await expect(
      bulkRestoreAccounts(TEST_SUBDOMAIN, ["acc-trashed-code"], "user-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("account archive guards", () => {
  it("refuses to archive an account the posting rules point at", async () => {
    await expect(bulkSoftDeleteAccounts(TEST_SUBDOMAIN, ["acc-cash"], "u1")).rejects.toMatchObject({
      statusCode: 422,
      type: "account_configured",
    });
  });

  it("refuses to archive the retained-earnings account the close posts to", async () => {
    await expect(
      bulkSoftDeleteAccounts(TEST_SUBDOMAIN, ["acc-retained"], "u1"),
    ).rejects.toMatchObject({ statusCode: 422, type: "account_configured" });
  });

  it("refuses to archive a parent that still has active children", async () => {
    await expect(bulkSoftDeleteAccounts(TEST_SUBDOMAIN, ["acc-root"], "u1")).rejects.toMatchObject({
      statusCode: 422,
      type: "account_has_children",
    });
  });

  it("refuses to archive an account with posted ledger lines", async () => {
    await expect(
      bulkSoftDeleteAccounts(TEST_SUBDOMAIN, ["acc-earmarked"], "u1"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("allows archiving an account referenced only by a draft entry", async () => {
    const result = await bulkSoftDeleteAccounts(TEST_SUBDOMAIN, ["acc-free"], "u1", "unused");
    expect(result).toEqual({ succeeded: 1, failed: 0 });
    // Restore it so the remaining cases keep a stable fixture.
    await bulkRestoreAccounts(TEST_SUBDOMAIN, ["acc-free"], "u1");
  });

  it("refuses a raw archive that bypasses the repository guard", async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    const error = await tx.tx
      .execute(sql`UPDATE accounting_accounts SET deleted_at = now() WHERE id = 'acc-cash'`)
      .then(() => undefined)
      .catch((err: unknown) => err);
    await tx.rollback().catch(() => undefined);
    expect(extractPgErrorCode(error)).toBe("23514");
  });
});

describe("restore provenance", () => {
  it("stamps restored_at and restored_by on restore", async () => {
    await bulkSoftDeleteAccounts(TEST_SUBDOMAIN, ["acc-free"], "u1", "tidy");
    const result = await bulkRestoreAccounts(TEST_SUBDOMAIN, ["acc-free"], "user-42");
    expect(result.succeeded).toBe(1);
    const [row] = await listAccountsByWorkspace(TEST_SUBDOMAIN, { deleted: "all" }).then((rows) =>
      rows.filter((candidate) => candidate.id === "acc-free"),
    );
    expect(row?.restoredBy).toBe("user-42");
    expect(row?.restoredAt).toBeTruthy();
    expect(row?.deletedAt ?? null).toBeNull();
  });

  it("rejects a raw restore that does not say who restored the row", async () => {
    const archive = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    await archive.tx.execute(
      sql`UPDATE accounting_accounts SET deleted_at = now(), deleted_by = 'u1', restored_at = NULL, restored_by = NULL WHERE id = 'acc-free'`,
    );
    await archive.commit();

    const restore = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    const error = await restore.tx
      .execute(
        sql`UPDATE accounting_accounts SET deleted_at = NULL, deleted_by = NULL WHERE id = 'acc-free'`,
      )
      .then(() => undefined)
      .catch((err: unknown) => err);
    await restore.rollback().catch(() => undefined);
    expect(extractPgErrorCode(error)).toBe("23514");

    await bulkRestoreAccounts(TEST_SUBDOMAIN, ["acc-free"], "u1");
  });

  it("rejects a restore that replays attribution older than the deletion", async () => {
    await bulkSoftDeleteAccounts(TEST_SUBDOMAIN, ["acc-free"], "u1", "tidy");
    const restore = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    const error = await restore.tx
      .execute(
        sql`UPDATE accounting_accounts
               SET deleted_at = NULL, deleted_by = NULL,
                   restored_at = '2020-01-01T00:00:00.000Z', restored_by = 'stale'
             WHERE id = 'acc-free'`,
      )
      .then(() => undefined)
      .catch((err: unknown) => err);
    await restore.rollback().catch(() => undefined);
    expect(extractPgErrorCode(error)).toBe("23514");
    await bulkRestoreAccounts(TEST_SUBDOMAIN, ["acc-free"], "u1");
  });
});

describe("optimistic concurrency on account configuration", () => {
  it("rejects a changed account whose updatedAt token is stale", async () => {
    const current = (await listAccountsByWorkspace(TEST_SUBDOMAIN)).find(
      (row) => row.id === "acc-child",
    )!;
    const stale = "2026-01-01T00:00:00.000Z";
    await expect(
      bulkSaveAccounts(TEST_SUBDOMAIN, [{ ...current, name: "Renamed", updatedAt: stale }]),
    ).rejects.toMatchObject({ statusCode: 409, type: "stale_write" });
  });

  it("accepts an unchanged row whose token is stale (nothing to lose)", async () => {
    const current = (await listAccountsByWorkspace(TEST_SUBDOMAIN)).find(
      (row) => row.id === "acc-child",
    )!;
    await expect(
      bulkSaveAccounts(TEST_SUBDOMAIN, [{ ...current, updatedAt: "2026-01-01T00:00:00.000Z" }]),
    ).resolves.toBeUndefined();
  });

  it("accepts a change with the current token and hands back the new one", async () => {
    const current = (await listAccountsByWorkspace(TEST_SUBDOMAIN)).find(
      (row) => row.id === "acc-child",
    )!;
    const patch = { ...current, name: "Cash (renamed)" };
    await bulkSaveAccounts(TEST_SUBDOMAIN, [patch]);
    expect(patch.updatedAt).toBeTruthy();
    const reread = (await listAccountsByWorkspace(TEST_SUBDOMAIN)).find(
      (row) => row.id === "acc-child",
    )!;
    expect(reread.name).toBe("Cash (renamed)");
  });

  it("does not clear a parent when the payload omits one", async () => {
    const current = (await listAccountsByWorkspace(TEST_SUBDOMAIN)).find(
      (row) => row.id === "acc-child",
    )!;
    const { parentId: _omitted, ...withoutParent } = current;
    await bulkSaveAccounts(TEST_SUBDOMAIN, [withoutParent as Account]);
    const reread = (await listAccountsByWorkspace(TEST_SUBDOMAIN)).find(
      (row) => row.id === "acc-child",
    )!;
    expect(reread.parentId).toBe("acc-root");
  });
});
