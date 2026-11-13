import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import {
  workspaces,
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  accountingEntryTags,
  accountingEntryAttachments,
} from "../../db/schema.js";
import { bulkSaveEntries } from "../../db/repositories/accountingEntriesPersist.js";
import type { JournalEntry } from "@mms/shared";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TEST_SUBDOMAIN = "perf-parity-accounting";

/** Backend root from this test file (src/__tests__/db-integration -> backend). */
beforeAll(async () => {
  await requireDatabaseConnection();

  const preCleanupTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await preCleanupTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await preCleanupTx.tx
      .delete(accountingEntryAttachments)
      .where(eq(accountingEntryAttachments.workspaceSubdomain, TEST_SUBDOMAIN));
    await preCleanupTx.tx
      .delete(accountingEntryTags)
      .where(eq(accountingEntryTags.workspaceSubdomain, TEST_SUBDOMAIN));
    await preCleanupTx.tx
      .delete(accountingJournalLines)
      .where(eq(accountingJournalLines.workspaceSubdomain, TEST_SUBDOMAIN));
    await preCleanupTx.tx
      .delete(accountingEntries)
      .where(eq(accountingEntries.workspaceSubdomain, TEST_SUBDOMAIN));
    await preCleanupTx.tx
      .delete(accountingAccounts)
      .where(eq(accountingAccounts.workspaceSubdomain, TEST_SUBDOMAIN));
    await preCleanupTx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
    await preCleanupTx.commit();
  } catch {
    await preCleanupTx.rollback().catch(() => undefined);
  }

  const seedTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await seedTx.tx.insert(workspaces).values({
      id: "ws-perf-parity-accounting",
      subdomain: TEST_SUBDOMAIN,
      madrasaName: "Perf Parity Accounting",
      enabled: true,
    });
    // Accounts referenced by journal lines (FK).
    await seedTx.tx.insert(accountingAccounts).values([
      {
        id: "acc-1",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "1000",
        name: "Cash",
        type: "Asset",
      },
      {
        id: "acc-2",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "2000",
        name: "Revenue",
        type: "Revenue",
      },
    ]);
    // Existing entry that the batch will update (with children to be replaced).
    await seedTx.tx.insert(accountingEntries).values({
      id: "entry-existing",
      workspaceSubdomain: TEST_SUBDOMAIN,
      date: "2026-01-01",
      ref: "REF-OLD",
      description: "old description",
      // Draft on purpose: the draft replacement path is what this test proves.
      // A posted entry's ledger lines are immutable (see the test below).
      status: "draft",
      createdBy: "u1",
      fiscalYear: "FY2026",
      updatedAt: new Date(),
    });
    await seedTx.tx.insert(accountingJournalLines).values({
      id: "line-old-1",
      workspaceSubdomain: TEST_SUBDOMAIN,
      entryId: "entry-existing",
      accountId: "acc-1",
      debit: "100",
      credit: "0",
      description: "old line",
    });
    await seedTx.tx.insert(accountingEntryTags).values({
      workspaceSubdomain: TEST_SUBDOMAIN,
      entryId: "entry-existing",
      tag: "old-tag",
    });
    await seedTx.tx.insert(accountingEntryAttachments).values({
      workspaceSubdomain: TEST_SUBDOMAIN,
      entryId: "entry-existing",
      url: "old-attachment",
    });
    // Entry NOT in the batch — must be preserved untouched.
    await seedTx.tx.insert(accountingEntries).values({
      id: "entry-untouched",
      workspaceSubdomain: TEST_SUBDOMAIN,
      date: "2026-01-02",
      ref: "REF-UNTOUCHED",
      description: "untouched",
      status: "posted",
      createdBy: "u1",
      fiscalYear: "FY2026",
      updatedAt: new Date(),
    });
    await seedTx.commit();
  } catch (error) {
    await seedTx.rollback().catch(() => undefined);
    throw error;
  }
});

afterAll(async () => {
  {
    const cleanupTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await cleanupTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await cleanupTx.tx
        .delete(accountingEntryAttachments)
        .where(eq(accountingEntryAttachments.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx
        .delete(accountingEntryTags)
        .where(eq(accountingEntryTags.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx
        .delete(accountingJournalLines)
        .where(eq(accountingJournalLines.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx
        .delete(accountingEntries)
        .where(eq(accountingEntries.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx
        .delete(accountingAccounts)
        .where(eq(accountingAccounts.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
      await cleanupTx.commit();
    } catch {
      await cleanupTx.rollback().catch(() => undefined);
    }
  }
  await closeDatabase();
});

describe("bulkSaveEntries batched upsert parity", () => {
  it("upserts entries and replaces children while preserving untouched rows", async () => {
    const batch: JournalEntry[] = [
      {
        id: "entry-existing",
        date: "2026-01-01",
        ref: "REF-NEW",
        description: "updated description",
        status: "draft",
        created_by: "u1",
        fiscal_year: "FY2026",
        tags: ["new-tag"],
        attachments: ["new-attachment"],
        lines: [
          { id: "line-new-1", account_id: "acc-2", debit: 200, credit: 0, description: "new line" },
        ],
      },
      {
        id: "entry-new",
        date: "2026-01-03",
        ref: "REF-NEW-ENTRY",
        description: "brand new",
        status: "draft",
        created_by: "u1",
        fiscal_year: "FY2026",
        tags: ["tag-a", "tag-b"],
        attachments: [],
        lines: [],
      },
    ];

    await bulkSaveEntries(TEST_SUBDOMAIN, batch);

    const verifyTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      const entries = await verifyTx.tx
        .select()
        .from(accountingEntries)
        .where(eq(accountingEntries.workspaceSubdomain, TEST_SUBDOMAIN));
      const byId = new Map(entries.map((e) => [e.id, e]));

      // Existing entry updated in place (not duplicated); new entry inserted;
      // untouched entry preserved.
      expect(entries.length).toBe(3);
      expect(byId.get("entry-existing")?.ref).toBe("REF-NEW");
      expect(byId.get("entry-existing")?.description).toBe("updated description");
      expect(byId.get("entry-new")?.status).toBe("draft");
      expect(byId.get("entry-untouched")?.ref).toBe("REF-UNTOUCHED");

      // Children of the existing entry were replaced (old removed, new present).
      const lines = await verifyTx.tx
        .select()
        .from(accountingJournalLines)
        .where(
          and(
            eq(accountingJournalLines.workspaceSubdomain, TEST_SUBDOMAIN),
            eq(accountingJournalLines.entryId, "entry-existing"),
          ),
        );
      expect(lines.map((l) => l.id)).toEqual(["line-new-1"]);
      expect(lines[0]?.accountId).toBe("acc-2");

      const tags = await verifyTx.tx
        .select()
        .from(accountingEntryTags)
        .where(
          and(
            eq(accountingEntryTags.workspaceSubdomain, TEST_SUBDOMAIN),
            eq(accountingEntryTags.entryId, "entry-existing"),
          ),
        );
      expect(tags.map((t) => t.tag)).toEqual(["new-tag"]);

      const atts = await verifyTx.tx
        .select()
        .from(accountingEntryAttachments)
        .where(
          and(
            eq(accountingEntryAttachments.workspaceSubdomain, TEST_SUBDOMAIN),
            eq(accountingEntryAttachments.entryId, "entry-existing"),
          ),
        );
      expect(atts.map((a) => a.url)).toEqual(["new-attachment"]);

      await verifyTx.commit();
    } catch (error) {
      await verifyTx.rollback().catch(() => undefined);
      throw error;
    }
  });

  it("never rewrites the lines of a posted entry", async () => {
    // A posted entry is immutable: the app layer rejects any content change, and
    // the persist layer is told to leave its children alone. The row set must be
    // byte-identical before and after the save.
    const batch: JournalEntry[] = [
      {
        id: "entry-untouched",
        date: "2026-01-02",
        ref: "REF-UNTOUCHED",
        description: "untouched",
        status: "posted",
        created_by: "u1",
        fiscal_year: "FY2026",
        tags: [],
        attachments: [],
        lines: [{ id: "posted-line", account_id: "acc-1", debit: 50, credit: 0, description: "p" }],
      },
    ];

    const seedTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await seedTx.tx.insert(accountingJournalLines).values({
        id: "posted-line",
        workspaceSubdomain: TEST_SUBDOMAIN,
        entryId: "entry-untouched",
        accountId: "acc-1",
        debit: "50",
        credit: "0",
        description: "p",
      });
      await seedTx.tx.insert(accountingJournalLines).values({
        id: "posted-line-2",
        workspaceSubdomain: TEST_SUBDOMAIN,
        entryId: "entry-untouched",
        accountId: "acc-2",
        debit: "0",
        credit: "50",
        description: "p2",
      });
      await seedTx.commit();
    } catch (error) {
      await seedTx.rollback().catch(() => undefined);
      throw error;
    }

    await bulkSaveEntries(TEST_SUBDOMAIN, batch, {
      preserveChildren: new Set(["entry-untouched"]),
    });

    const verifyTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      const lines = await verifyTx.tx
        .select()
        .from(accountingJournalLines)
        .where(
          and(
            eq(accountingJournalLines.workspaceSubdomain, TEST_SUBDOMAIN),
            eq(accountingJournalLines.entryId, "entry-untouched"),
          ),
        );
      expect(lines.map((line) => line.id).sort()).toEqual(["posted-line", "posted-line-2"]);
      await verifyTx.commit();
    } catch (error) {
      await verifyTx.rollback().catch(() => undefined);
      throw error;
    }
  });

  it("rejects a line rewrite of a posted entry that skips preserveChildren", async () => {
    // The database is the last line of defence: even a repository call that
    // forgets the flag cannot delete a posted entry's ledger lines.
    await expect(
      bulkSaveEntries(TEST_SUBDOMAIN, [
        {
          id: "entry-untouched",
          date: "2026-01-02",
          ref: "REF-UNTOUCHED",
          description: "untouched",
          status: "posted",
          created_by: "u1",
          fiscal_year: "FY2026",
          tags: [],
          attachments: [],
          lines: [],
        },
      ]),
    ).rejects.toThrow();
  });
});

/**
 * 0253 optimistic concurrency. A stale `updatedAt` token must not overwrite a
 * newer draft: the compare runs under `FOR UPDATE`, so the writer that waited
 * sees the committed row instead of replacing it. The token the save hands back
 * is what the client must send next.
 */
describe("optimistic concurrency on journal saves", () => {
  const draft = (overrides: Partial<JournalEntry> = {}): JournalEntry => ({
    id: "entry-existing",
    date: "2026-01-01",
    ref: "REF-NEW",
    description: "occ",
    status: "draft",
    created_by: "u1",
    fiscal_year: "FY2026",
    tags: [],
    attachments: [],
    lines: [],
    ...overrides,
  });

  async function readStoredUpdatedAt(id: string): Promise<string> {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      const [row] = await tx.tx
        .select()
        .from(accountingEntries)
        .where(eq(accountingEntries.id, id));
      await tx.commit();
      return (row?.updatedAt ?? new Date(0)).toISOString();
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  }

  it("rejects a changed draft whose updatedAt token is stale", async () => {
    await expect(
      bulkSaveEntries(TEST_SUBDOMAIN, [
        draft({ description: "stale write", updatedAt: "2026-01-01T00:00:00.000Z" }),
      ]),
    ).rejects.toMatchObject({ statusCode: 409, type: "stale_write" });
  });

  it("accepts the current token and hands back the token the next save needs", async () => {
    const current = await readStoredUpdatedAt("entry-existing");
    const record = draft({ description: "fresh write", updatedAt: current });
    await bulkSaveEntries(TEST_SUBDOMAIN, [record]);

    expect(new Date(record.updatedAt as string).getTime()).toBeGreaterThanOrEqual(
      new Date(current).getTime(),
    );
    // The stamped token must be accepted immediately: a client that saves twice
    // without refetching uses it.
    await expect(
      bulkSaveEntries(TEST_SUBDOMAIN, [{ ...record, description: "second write" }]),
    ).resolves.toBeUndefined();
  });

  it("accepts a batch that carries no tokens (system postings, conditional CAS)", async () => {
    await expect(
      bulkSaveEntries(TEST_SUBDOMAIN, [
        draft({ description: "system write", updatedAt: undefined }),
      ]),
    ).resolves.toBeUndefined();
  });
});
