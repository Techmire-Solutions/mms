import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import {
  workspaces,
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  accountingEntryTags,
  accountingEntryAttachments,
} from "../../db/schema.js";
import { listEntriesPage } from "../../db/repositories/accountingRepositoryListEntries.js";
import { listAccountsPage } from "../../db/repositories/accountingRepositoryListPages.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import { withActiveTransaction } from "../../db/dbTransactions.js";

const TEST_SUBDOMAIN = "list-filters-accounting";

const ACCOUNTS = [
  { id: "f-cash", code: "1000", name: "Cash", type: "Asset", subtype: "Current", isActive: true },
  {
    id: "f-misc",
    code: "1090",
    name: "Suspense",
    type: "Asset",
    subtype: "Current",
    isActive: false,
  },
  {
    id: "f-fees",
    code: "4000",
    name: "Tuition Fees",
    type: "Revenue",
    subtype: "",
    isActive: true,
  },
];

/** [id, date, status, accountId] — each entry posts one balanced pair. */
const ENTRIES: [string, string, string, string][] = [
  ["f-e-jan-posted", "2026-01-15", "posted", "f-fees"],
  ["f-e-jun-posted", "2026-06-15", "posted", "f-fees"],
  ["f-e-jun-draft", "2026-06-20", "draft", "f-cash"],
  ["f-e-dec-posted", "2026-12-01", "posted", "f-cash"],
];

/** [entryId, tag] — tags live in their own table, which is why the filter needs a subquery. */
const ENTRY_TAGS: [string, string][] = [
  ["f-e-jan-posted", "fee"],
  ["f-e-jun-posted", "fee"],
  ["f-e-dec-posted", "adjustment"],
];

async function purge(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
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
  await requireDatabaseConnection();

  await purge().catch(() => undefined);

  const seedTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await seedTx.tx.insert(workspaces).values({
      id: "ws-list-filters-accounting",
      subdomain: TEST_SUBDOMAIN,
      madrasaName: "List Filters Accounting",
      enabled: true,
    });
    await seedTx.tx.insert(accountingAccounts).values(
      ACCOUNTS.map((account) => ({
        ...account,
        workspaceSubdomain: TEST_SUBDOMAIN,
        description: "",
      })),
    );
    await seedTx.tx.insert(accountingEntries).values(
      ENTRIES.map(([id, date, status]) => ({
        id,
        workspaceSubdomain: TEST_SUBDOMAIN,
        date,
        ref: id,
        description: id,
        status,
        createdBy: "u1",
        fiscalYear: "",
      })),
    );
    await seedTx.tx.insert(accountingEntryTags).values(
      ENTRY_TAGS.map(([entryId, tag]) => ({
        workspaceSubdomain: TEST_SUBDOMAIN,
        entryId,
        tag,
      })),
    );
    await seedTx.tx.insert(accountingJournalLines).values(
      ENTRIES.flatMap(([entryId, , , accountId]) => [
        {
          id: `${entryId}-d`,
          workspaceSubdomain: TEST_SUBDOMAIN,
          entryId,
          accountId,
          debit: "10",
          credit: "0",
          description: "",
        },
        {
          id: `${entryId}-c`,
          workspaceSubdomain: TEST_SUBDOMAIN,
          entryId,
          accountId: "f-cash",
          debit: "0",
          credit: "10",
          description: "",
        },
      ]),
    );
    await seedTx.commit();
  } catch (error) {
    await seedTx.rollback().catch(() => undefined);
    throw error;
  }
});

afterAll(async () => {
  await purge().catch(() => undefined);
  await closeDatabase().catch(() => undefined);
});

/** Ids returned by the paginated entry list for a query. */
async function entryIds(query: Parameters<typeof listEntriesPage>[1]): Promise<string[]> {
  const page = await listEntriesPage(TEST_SUBDOMAIN, { page: 1, limit: 100, ...query });
  return page.entries.map((entry) => entry.id).sort();
}

describe("accounting list filters (real Postgres)", () => {
  it("filters journal entries by status", async () => {
    expect(await entryIds({ status: "draft" })).toEqual(["f-e-jun-draft"]);
    expect(await entryIds({ status: "posted" })).toEqual([
      "f-e-dec-posted",
      "f-e-jan-posted",
      "f-e-jun-posted",
    ]);
  });

  it("filters journal entries by date range, inclusive of both ends", async () => {
    expect(await entryIds({ dateFrom: "2026-06-01", dateTo: "2026-06-30" })).toEqual([
      "f-e-jun-draft",
      "f-e-jun-posted",
    ]);
    expect(await entryIds({ dateFrom: "2026-06-15" })).toEqual([
      "f-e-dec-posted",
      "f-e-jun-draft",
      "f-e-jun-posted",
    ]);
    expect(await entryIds({ dateTo: "2026-01-31" })).toEqual(["f-e-jan-posted"]);
  });

  it("filters journal entries to those carrying a line on one account", async () => {
    // Only the fee entries have a line on the revenue account; the cash entries
    // do too because both legs of every seeded entry touch f-cash, so pair the
    // account filter with a date range to prove it narrows the set.
    expect(await entryIds({ accountId: "f-fees" })).toEqual(["f-e-jan-posted", "f-e-jun-posted"]);
    expect(await entryIds({ accountId: "f-misc" })).toEqual([]);
  });

  it("filters journal entries by tag", async () => {
    // The tag filter used to run in the browser only, so once the list pages on
    // the server it would have narrowed the loaded page instead of the journal.
    expect(await entryIds({ tag: "fee" })).toEqual(["f-e-jan-posted", "f-e-jun-posted"]);
    expect(await entryIds({ tag: "adjustment" })).toEqual(["f-e-dec-posted"]);
    expect(await entryIds({ tag: "no-such-tag" })).toEqual([]);
  });

  it("combines the tag filter with the other filters", async () => {
    expect(await entryIds({ tag: "fee", status: "posted", dateFrom: "2026-06-01" })).toEqual([
      "f-e-jun-posted",
    ]);
    expect(await entryIds({ tag: "fee", status: "draft" })).toEqual([]);
  });

  it("reports the filtered total, not the rows on the page", async () => {
    // What the pager and the "shown" metric read instead of the loaded array.
    const page = await listEntriesPage(TEST_SUBDOMAIN, {
      page: 1,
      limit: 1,
      tag: "fee",
      sortField: "date",
      sortDir: "desc",
    });
    expect(page.entries.map((entry) => entry.id)).toEqual(["f-e-jun-posted"]);
    expect(page.total).toBe(2);
    expect(page.hasMore).toBe(true);
  });

  it("combines the filters", async () => {
    expect(
      await entryIds({
        status: "posted",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
        accountId: "f-fees",
      }),
    ).toEqual(["f-e-jun-posted"]);
  });

  it("projects the active reversal id so a reversed voucher is detectable off-page", async () => {
    const tx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      await tx.tx.insert(accountingEntries).values({
        id: "f-e-reversal",
        workspaceSubdomain: TEST_SUBDOMAIN,
        date: "2026-06-20",
        ref: "REV-JAN",
        description: "Reversal of January fee",
        status: "posted",
        createdBy: "u1",
        fiscalYear: "",
        sourceType: "reversal",
        sourceId: "f-e-jan-posted",
      });
      // Join the open transaction so the uncommitted reversal is visible; the
      // whole check rolls back, leaving the shared fixture untouched.
      const page = await withActiveTransaction(tx.tx, () =>
        listEntriesPage(TEST_SUBDOMAIN, { page: 1, limit: 100 }),
      );
      const reversed = page.entries.find((entry) => entry.id === "f-e-jan-posted");
      const untouched = page.entries.find((entry) => entry.id === "f-e-jun-posted");

      expect(reversed?.active_reversal_entry_id).toBe("f-e-reversal");
      expect(untouched?.active_reversal_entry_id ?? null).toBeNull();
    } finally {
      await tx.rollback().catch(() => undefined);
    }
  });

  it("filters accounts by type", async () => {
    const revenue = await listAccountsPage(TEST_SUBDOMAIN, {
      page: 1,
      limit: 100,
      accountType: "Revenue",
    });
    expect(revenue.accounts.map((account) => account.id)).toEqual(["f-fees"]);

    const assets = await listAccountsPage(TEST_SUBDOMAIN, {
      page: 1,
      limit: 100,
      accountType: "Asset",
    });
    expect(assets.accounts.map((account) => account.id).sort()).toEqual(["f-cash", "f-misc"]);

    const expenses = await listAccountsPage(TEST_SUBDOMAIN, {
      page: 1,
      limit: 100,
      accountType: "Expense",
    });
    expect(expenses.accounts).toEqual([]);
  });

  it("still reports an unfiltered total for the pager", async () => {
    const all = await listEntriesPage(TEST_SUBDOMAIN, { page: 1, limit: 2 });
    expect(all.total).toBe(ENTRIES.length);
    expect(all.hasMore).toBe(true);
  });
});

describe("journal register projection (includeLines)", () => {
  it("returns header totals and no line rows when the register asks for headers only", async () => {
    // Arrange / Act: the full page and the projected page over the same data.
    const full = await listEntriesPage(TEST_SUBDOMAIN, { page: 1, limit: 100 });
    const projected = await listEntriesPage(TEST_SUBDOMAIN, {
      page: 1,
      limit: 100,
      includeLines: false,
    });
    const fullById = new Map(full.entries.map((entry) => [entry.id, entry]));

    // Assert: same headers, no line sets, and the totals equal the full read.
    expect(projected.entries.map((entry) => entry.id).sort()).toEqual(
      full.entries.map((entry) => entry.id).sort(),
    );
    for (const entry of projected.entries) {
      const complete = fullById.get(entry.id)!;
      expect(entry.lines).toEqual([]);
      expect(entry.lineCount).toBe(complete.lines.length);
      expect(entry.debitTotal).toBe(
        complete.lines.reduce((sum, line) => sum + Number(line.debit), 0),
      );
      expect(entry.creditTotal).toBe(
        complete.lines.reduce((sum, line) => sum + Number(line.credit), 0),
      );
      // Tags are row-rendered chips and stay in the projection.
      expect(entry.tags).toEqual(complete.tags);
    }
  });

  it("keeps the cursor page working with the projection", async () => {
    const first = await listEntriesPage(TEST_SUBDOMAIN, {
      page: 1,
      limit: 2,
      includeLines: false,
    });
    // The offset page is date-ordered while keyset paging is id-ordered, so the
    // cursor starts from the smallest id of that page (greater ids must remain).
    const cursor = [...first.entries.map((entry) => entry.id)].sort()[0]!;
    const second = await listEntriesPage(TEST_SUBDOMAIN, {
      page: 1,
      limit: 2,
      afterId: cursor,
      includeLines: false,
    });

    expect(second.entries.every((entry) => entry.id > cursor)).toBe(true);
    expect(second.entries.every((entry) => entry.lines.length === 0)).toBe(true);
    expect(second.nextCursor).toBeDefined();
  });
});
