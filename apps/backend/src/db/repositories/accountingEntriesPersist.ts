import { and, eq, inArray, sql } from "drizzle-orm";
import type { JournalEntry } from "@mms/shared";
import {
  accountingEntries,
  accountingJournalLines,
  accountingEntryTags,
  accountingEntryAttachments,
} from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { lockJournalEntries } from "./accountingEntryLocks.js";
import { entryInsertValues } from "./accountingEntriesLifecyclePersist.js";

export * from "./accountingEntriesLifecyclePersist.js";

async function syncEntryChildren(
  tx: TenantTransaction,
  subdomain: string,
  entry: JournalEntry,
): Promise<void> {
  await Promise.all([
    tx
      .delete(accountingJournalLines)
      .where(
        and(
          eq(accountingJournalLines.workspaceSubdomain, subdomain),
          eq(accountingJournalLines.entryId, entry.id),
        ),
      ),
    tx
      .delete(accountingEntryTags)
      .where(
        and(
          eq(accountingEntryTags.workspaceSubdomain, subdomain),
          eq(accountingEntryTags.entryId, entry.id),
        ),
      ),
    tx
      .delete(accountingEntryAttachments)
      .where(
        and(
          eq(accountingEntryAttachments.workspaceSubdomain, subdomain),
          eq(accountingEntryAttachments.entryId, entry.id),
        ),
      ),
  ]);

  if (entry.lines && entry.lines.length > 0) {
    await tx.insert(accountingJournalLines).values(
      entry.lines.map((l) => ({
        id: l.id,
        workspaceSubdomain: subdomain,
        entryId: entry.id,
        accountId: l.account_id,
        debit: String(l.debit ?? 0),
        credit: String(l.credit ?? 0),
        description: l.description ?? "",
      })),
    );
  }

  if (entry.tags && entry.tags.length > 0) {
    await tx.insert(accountingEntryTags).values(
      entry.tags.map((tag) => ({
        workspaceSubdomain: subdomain,
        entryId: entry.id,
        tag,
      })),
    );
  }

  if (entry.attachments && entry.attachments.length > 0) {
    await tx.insert(accountingEntryAttachments).values(
      entry.attachments.map((url) => ({
        workspaceSubdomain: subdomain,
        entryId: entry.id,
        url,
      })),
    );
  }
}

export async function saveEntry(tenant: string, record: JournalEntry): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await lockJournalEntries(subdomain, [record.id]);
    await tx
      .insert(accountingEntries)
      .values(entryInsertValues(subdomain, record))
      .onConflictDoUpdate({
        target: [accountingEntries.workspaceSubdomain, accountingEntries.id],
        set: entryUpdateSetValues(record),
      });

    await syncEntryChildren(tx, subdomain, record);
  });
}

/**
 * SET values for the single-record upsert.
 *
 * Trash/restore own the soft-delete columns, so they are dropped here. A whole
 * journal list save re-sends `deletedAt: null` for every active row it holds, and
 * writing that through meant a save in one session silently un-deleted a row
 * another session had trashed (or re-deleted a restored one). Soft-delete state
 * now changes only through {@link bulkSoftDeleteEntries} /
 * {@link bulkRestoreEntries}.
 */
function entryUpdateSetValues(record: JournalEntry) {
  const {
    id: _id,
    workspaceSubdomain: _subdomain,
    deletedAt: _deletedAt,
    deletedBy: _deletedBy,
    deletionReason: _deletionReason,
    ...setFields
  } = entryInsertValues("", record);
  return setFields;
}

export async function bulkSaveEntries(tenant: string, records: JournalEntry[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, JournalEntry>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;
  const entryIds = uniqueRecords.map((r) => r.id);

  await withTenant(subdomain, async (tx) => {
    await lockJournalEntries(subdomain, entryIds);
    // Single batched upsert of all entries (keeps rows not in the batch, updates
    // matching rows — semantically identical to the previous per-record upsert).
    // The soft-delete columns are deliberately absent from this SET list: a bulk
    // list save re-sends `deletedAt: null` for every active row it holds, which
    // used to un-delete rows another session had trashed. Trash/restore own them.
    await tx
      .insert(accountingEntries)
      .values(uniqueRecords.map((record) => entryInsertValues(subdomain, record)))
      .onConflictDoUpdate({
        target: [accountingEntries.workspaceSubdomain, accountingEntries.id],
        set: {
          date: sql.raw("excluded.date"),
          ref: sql.raw("excluded.ref"),
          description: sql.raw("excluded.description"),
          status: sql.raw("excluded.status"),
          createdBy: sql.raw("excluded.created_by"),
          fiscalYear: sql.raw("excluded.fiscal_year"),
          fiscalYearId: sql.raw("excluded.fiscal_year_id"),
          sourceType: sql.raw("excluded.source_type"),
          sourceId: sql.raw("excluded.source_id"),
          transactionType: sql.raw("excluded.transaction_type"),
          reversedRef: sql.raw("excluded.reversed_ref"),
          simpleMode: sql.raw("excluded.simple_mode"),
          updatedAt: sql.raw("excluded.updated_at"),
        },
      });

    // Batch child replacement: delete all children of the touched entries, then
    // re-insert the provided children — identical final state to the previous
    // per-entry syncEntryChildren, but via 3 batched deletes + 3 batched inserts.
    await Promise.all([
      tx
        .delete(accountingJournalLines)
        .where(
          and(
            eq(accountingJournalLines.workspaceSubdomain, subdomain),
            inArray(accountingJournalLines.entryId, entryIds),
          ),
        ),
      tx
        .delete(accountingEntryTags)
        .where(
          and(
            eq(accountingEntryTags.workspaceSubdomain, subdomain),
            inArray(accountingEntryTags.entryId, entryIds),
          ),
        ),
      tx
        .delete(accountingEntryAttachments)
        .where(
          and(
            eq(accountingEntryAttachments.workspaceSubdomain, subdomain),
            inArray(accountingEntryAttachments.entryId, entryIds),
          ),
        ),
    ]);

    const allLines = uniqueRecords.flatMap((record) =>
      (record.lines ?? []).map((l) => ({
        id: l.id,
        workspaceSubdomain: subdomain,
        entryId: record.id,
        accountId: l.account_id,
        debit: String(l.debit ?? 0),
        credit: String(l.credit ?? 0),
        description: l.description ?? "",
      })),
    );
    if (allLines.length > 0) {
      await tx.insert(accountingJournalLines).values(allLines);
    }

    const allTags = uniqueRecords.flatMap((record) =>
      (record.tags ?? []).map((tag) => ({
        workspaceSubdomain: subdomain,
        entryId: record.id,
        tag,
      })),
    );
    if (allTags.length > 0) {
      await tx.insert(accountingEntryTags).values(allTags);
    }

    const allAttachments = uniqueRecords.flatMap((record) =>
      (record.attachments ?? []).map((url) => ({
        workspaceSubdomain: subdomain,
        entryId: record.id,
        url,
      })),
    );
    if (allAttachments.length > 0) {
      await tx.insert(accountingEntryAttachments).values(allAttachments);
    }
  });
}
