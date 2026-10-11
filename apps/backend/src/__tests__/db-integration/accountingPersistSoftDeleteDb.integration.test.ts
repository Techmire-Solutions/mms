import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeDatabaseConnection,
  pingDatabase,
  closeDatabase,
  beginLongLivedTenantTransaction,
} from "../../db/dbConnection.js";
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

/**
 * A whole-list journal save re-sends every row it holds, including
 * `deletedAt: null` for the rows it believes are active. The upsert must not
 * write that back: trash/restore own the soft-delete columns, otherwise a save
 * in one session silently un-deletes a row another session archived (or
 * re-deletes a restored one).
 */
const TEST_SUBDOMAIN = "softdelete-parity-accounting";

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
const trashedAt = new Date("2026-02-01T00:00:00.000Z");

async function purgeWorkspace(): Promise<void> {
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
  } catch {
    await tx.rollback().catch(() => undefined);
  }
}

beforeAll(async () => {
  applyDatabaseUrlFromEnvFile();
  initializeDatabaseConnection();
  dbAvailable = await pingDatabase();
  if (!dbAvailable) return;

  await purgeWorkspace();

  const seedTx = await beginLongLivedTenantTransaction(null);
  try {
    await seedTx.tx.insert(workspaces).values({
      id: "ws-softdelete-parity-accounting",
      subdomain: TEST_SUBDOMAIN,
      madrasaName: "Soft Delete Parity Accounting",
      enabled: true,
    });
    await seedTx.tx.insert(accountingAccounts).values([
      {
        id: "sd-acc-1",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "1000",
        name: "Cash",
        type: "asset",
      },
      {
        id: "sd-acc-2",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "4000",
        name: "Income",
        type: "revenue",
      },
    ]);
    await seedTx.tx.insert(accountingEntries).values([
      {
        id: "sd-entry-trashed",
        workspaceSubdomain: TEST_SUBDOMAIN,
        date: "2026-01-01",
        ref: "REF-TRASHED",
        description: "trashed by another session",
        status: "draft",
        createdBy: "u1",
        fiscalYear: "FY2026",
        deletedAt: trashedAt,
        deletedBy: "other-session",
        deletionReason: "duplicate",
        updatedAt: new Date(),
      },
      {
        id: "sd-entry-active",
        workspaceSubdomain: TEST_SUBDOMAIN,
        date: "2026-01-02",
        ref: "REF-ACTIVE",
        description: "active row",
        status: "draft",
        createdBy: "u1",
        fiscalYear: "FY2026",
        updatedAt: new Date(),
      },
    ]);
    await seedTx.commit();
  } catch (error) {
    await seedTx.rollback().catch(() => undefined);
    throw error;
  }
});

afterAll(async () => {
  if (dbAvailable) await purgeWorkspace();
  await closeDatabase();
});

describe("bulkSaveEntries soft-delete ownership", () => {
  it("does not resurrect a trashed row and does not re-trash an active one", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    // A whole-list save from a session that still believes both rows are active.
    const batch: JournalEntry[] = [
      {
        id: "sd-entry-trashed",
        date: "2026-01-01",
        ref: "REF-TRASHED-EDITED",
        description: "edited while trashed elsewhere",
        status: "draft",
        created_by: "u1",
        fiscal_year: "FY2026",
        tags: [],
        attachments: [],
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        lines: [
          { id: "sd-line-1", account_id: "sd-acc-1", debit: 10, credit: 0, description: "" },
          { id: "sd-line-2", account_id: "sd-acc-2", debit: 0, credit: 10, description: "" },
        ],
      },
      {
        id: "sd-entry-active",
        date: "2026-01-02",
        ref: "REF-ACTIVE",
        description: "active row",
        status: "draft",
        created_by: "u1",
        fiscal_year: "FY2026",
        tags: [],
        attachments: [],
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        lines: [],
      },
      {
        id: "sd-entry-new",
        date: "2026-01-03",
        ref: "REF-NEW",
        description: "brand new",
        status: "draft",
        created_by: "u1",
        fiscal_year: "FY2026",
        tags: [],
        attachments: [],
        deletedAt: null,
        lines: [],
      },
    ];

    await bulkSaveEntries(TEST_SUBDOMAIN, batch);

    const verifyTx = await beginLongLivedTenantTransaction(null);
    try {
      const entries = await verifyTx.tx
        .select()
        .from(accountingEntries)
        .where(eq(accountingEntries.workspaceSubdomain, TEST_SUBDOMAIN));
      const byId = new Map(entries.map((entry) => [entry.id, entry]));

      const trashed = byId.get("sd-entry-trashed");
      // Content still updates…
      expect(trashed?.ref).toBe("REF-TRASHED-EDITED");
      // …but the trashed state another session owns is untouched (the batch
      // sent deletedAt/deletedBy/deletionReason as null for this row).
      expect(trashed?.deletedAt).not.toBeNull();
      expect(trashed?.deletedBy).toBe("other-session");
      expect(trashed?.deletionReason).toBe("duplicate");

      expect(byId.get("sd-entry-active")?.deletedAt).toBeNull();
      expect(byId.get("sd-entry-new")?.deletedAt).toBeNull();

      // Lines are still replaced for a row that stays trashed.
      const lines = await verifyTx.tx
        .select()
        .from(accountingJournalLines)
        .where(
          and(
            eq(accountingJournalLines.workspaceSubdomain, TEST_SUBDOMAIN),
            eq(accountingJournalLines.entryId, "sd-entry-trashed"),
          ),
        );
      expect(lines.map((line) => line.id).sort()).toEqual(["sd-line-1", "sd-line-2"]);

      await verifyTx.commit();
    } catch (error) {
      await verifyTx.rollback().catch(() => undefined);
      throw error;
    }
  });
});
