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
import { ensureCurrencySettingsInTx } from "./accountingCurrencySettingsRepository.js";
import { journalLineFxInsertValues } from "./accountingJournalLineFx.js";

export * from "./accountingEntriesLifecyclePersist.js";

/**
 * Deletes the child rows of the given entries.
 *
 * Runs BEFORE the parent upsert on purpose. Posting a draft rewrites its lines,
 * and the database only lets that happen while the parent still reads `draft`
 * (0248 rejects UPDATE/DELETE on the lines of a posted entry). Upserting first
 * would flip the parent to `posted` and make a legitimate draft→posted save
 * fail. Line INSERTs are allowed either way, so new entries are unaffected.
 */
async function clearEntryChildren(
  tx: TenantTransaction,
  subdomain: string,
  entryIds: readonly string[],
): Promise<void> {
  if (entryIds.length === 0) return;
  await Promise.all([
    tx
      .delete(accountingJournalLines)
      .where(
        and(
          eq(accountingJournalLines.workspaceSubdomain, subdomain),
          inArray(accountingJournalLines.entryId, [...entryIds]),
        ),
      ),
    tx
      .delete(accountingEntryTags)
      .where(
        and(
          eq(accountingEntryTags.workspaceSubdomain, subdomain),
          inArray(accountingEntryTags.entryId, [...entryIds]),
        ),
      ),
    tx
      .delete(accountingEntryAttachments)
      .where(
        and(
          eq(accountingEntryAttachments.workspaceSubdomain, subdomain),
          inArray(accountingEntryAttachments.entryId, [...entryIds]),
        ),
      ),
  ]);
}

async function insertEntryChildren(
  tx: TenantTransaction,
  subdomain: string,
  entry: JournalEntry,
): Promise<void> {
  if (entry.lines && entry.lines.length > 0) {
    const { functionalCurrency } = await ensureCurrencySettingsInTx(tx, subdomain);
    await tx.insert(accountingJournalLines).values(
      entry.lines.map((l) => ({
        id: l.id,
        workspaceSubdomain: subdomain,
        entryId: entry.id,
        accountId: l.account_id,
        debit: String(l.debit ?? 0),
        credit: String(l.credit ?? 0),
        ...journalLineFxInsertValues(l, functionalCurrency, entry.date),
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
    // Children first: see clearEntryChildren. A promotion to `posted` must not
    // reach the line delete with the parent already flipped.
    await clearEntryChildren(tx, subdomain, [record.id]);
    await tx
      .insert(accountingEntries)
      .values(entryInsertValues(subdomain, record))
      .onConflictDoUpdate({
        target: [accountingEntries.workspaceSubdomain, accountingEntries.id],
        set: entryUpdateSetValues(record),
      });

    await insertEntryChildren(tx, subdomain, record);
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

export async function bulkSaveEntries(
  tenant: string,
  records: JournalEntry[],
  options?: { preserveChildren?: ReadonlySet<string> },
): Promise<void> {
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
  // Posted entries are immutable, so their children are already what the batch
  // carries; rewriting them would delete and reinsert ledger rows for no reason
  // (and 0248 rejects any write to a posted entry's lines).
  const preserved = options?.preserveChildren ?? new Set<string>();
  const childEntryIds = entryIds.filter((id) => !preserved.has(id));
  const childRecords = uniqueRecords.filter((record) => !preserved.has(record.id));

  await withTenant(subdomain, async (tx) => {
    await lockJournalEntries(subdomain, entryIds);
    // Children of the mutable entries are cleared while their parents still hold
    // their stored status; the upsert then flips statuses and the lines are
    // re-inserted (inserts are allowed on posted entries — the rewrite is not).
    await clearEntryChildren(tx, subdomain, childEntryIds);
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

    const { functionalCurrency } = await ensureCurrencySettingsInTx(tx, subdomain);
    const allLines = childRecords.flatMap((record) =>
      (record.lines ?? []).map((l) => ({
        id: l.id,
        workspaceSubdomain: subdomain,
        entryId: record.id,
        accountId: l.account_id,
        debit: String(l.debit ?? 0),
        credit: String(l.credit ?? 0),
        ...journalLineFxInsertValues(l, functionalCurrency, record.date),
        description: l.description ?? "",
      })),
    );
    if (allLines.length > 0) {
      await tx.insert(accountingJournalLines).values(allLines);
    }

    const allTags = childRecords.flatMap((record) =>
      (record.tags ?? []).map((tag) => ({
        workspaceSubdomain: subdomain,
        entryId: record.id,
        tag,
      })),
    );
    if (allTags.length > 0) {
      await tx.insert(accountingEntryTags).values(allTags);
    }

    const allAttachments = childRecords.flatMap((record) =>
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
