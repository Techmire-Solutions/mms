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
import {
  bulkRestoreAccounts,
  bulkSaveAccounts,
} from "../../db/repositories/accountingAccountsPersist.js";
import type { JournalEntry } from "@mms/shared";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * A whole-list journal save re-sends every row it holds, including
 * `deletedAt: null` for the rows it believes are active. The upsert must not
 * write that back: trash/restore own the soft-delete columns, otherwise a save
 * in one session silently un-deletes a row another session archived (or
 * re-deletes a restored one).
 */
const TEST_SUBDOMAIN = "softdelete-parity-accounting";

const trashedAt = new Date("2026-02-01T00:00:00.000Z");

async function purgeWorkspace(): Promise<void> {
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
  } catch {
    await tx.rollback().catch(() => undefined);
  }
}

beforeAll(async () => {
  await requireDatabaseConnection();

  await purgeWorkspace();

  const seedTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
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
        type: "Asset",
      },
      {
        id: "sd-acc-2",
        workspaceSubdomain: TEST_SUBDOMAIN,
        code: "4000",
        name: "Income",
        type: "Revenue",
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
  await purgeWorkspace();
  await closeDatabase();
});

describe("bulkSaveEntries soft-delete ownership", () => {
  it("does not resurrect a trashed row and does not re-trash an active one", async () => {
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

    const verifyTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
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

/**
 * The same ownership rule for the chart of accounts. The finance side was fixed
 * first; the COA kept writing `deleted_at` from the payload, so a whole-list
 * settings save could quietly resurrect an archived account (or archive an active
 * one) and never recorded who restored it.
 */
describe("bulkSaveAccounts soft-delete ownership", () => {
  const trashedAccount = {
    id: "sd-coa-trashed",
    code: "9100",
    name: "Archived elsewhere",
    type: "Asset" as const,
    subtype: "",
    description: "",
    isActive: true,
    deletedAt: trashedAt.toISOString(),
    deletedBy: "other-session",
    deletionReason: "merged",
  };
  const activeAccount = {
    id: "sd-coa-active",
    code: "9200",
    name: "Active",
    type: "Asset" as const,
    subtype: "",
    description: "",
    isActive: true,
  };

  it("does not resurrect a trashed account and does not re-trash an active one", async () => {
    // Seed both through the insert path (which legitimately carries the sextuple).
    await bulkSaveAccounts(TEST_SUBDOMAIN, [trashedAccount, activeAccount]);

    await bulkSaveAccounts(TEST_SUBDOMAIN, [
      {
        ...trashedAccount,
        name: "Renamed while trashed",
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
      },
      {
        ...activeAccount,
        name: "Renamed while active",
        deletedAt: trashedAt.toISOString(),
        deletedBy: "other-session",
        deletionReason: "oops",
      },
    ]);

    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      const rows = await tx.tx
        .select()
        .from(accountingAccounts)
        .where(eq(accountingAccounts.workspaceSubdomain, TEST_SUBDOMAIN));
      const byId = new Map(rows.map((row) => [row.id, row]));

      const trashed = byId.get("sd-coa-trashed");
      expect(trashed?.name).toBe("Renamed while trashed");
      expect(trashed?.deletedAt).not.toBeNull();
      expect(trashed?.deletedBy).toBe("other-session");
      expect(trashed?.deletionReason).toBe("merged");

      const active = byId.get("sd-coa-active");
      expect(active?.name).toBe("Renamed while active");
      expect(active?.deletedAt).toBeNull();
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  });

  it("writes restore attribution when an account is restored", async () => {
    const result = await bulkRestoreAccounts(TEST_SUBDOMAIN, ["sd-coa-trashed"], "restorer-1");
    expect(result.succeeded).toBe(1);

    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      const [row] = await tx.tx
        .select()
        .from(accountingAccounts)
        .where(eq(accountingAccounts.id, "sd-coa-trashed"));
      expect(row?.deletedAt).toBeNull();
      expect(row?.restoredBy).toBe("restorer-1");
      expect(row?.restoredAt).toBeTruthy();
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  });
});
