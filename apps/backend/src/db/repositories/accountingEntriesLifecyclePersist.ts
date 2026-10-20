import { and, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { dedupeTrimmedIds, type JournalEntry } from "@mms/shared";
import {
  accountingAccounts,
  accountingBankReconciliations,
  accountingBankStatementLines,
  accountingBankStatements,
  accountingEntries,
  accountingFiscalYears,
  accountingJournalLines,
  accountingEntryTags,
  accountingEntryAttachments,
  accountingOpeningBalances,
  accountingPostingRules,
} from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";

/**
 * Maps a JournalEntry to the accountingEntries insert/upsert value shape.
 *
 * The soft-delete columns ARE part of the insert values: a fresh row may
 * legitimately arrive already trashed (backup restore via
 * {@link replaceEntriesForWorkspace}, and the create path never sets them), and
 * the trash/restore paths own the transitions. They are removed from the UPDATE
 * sets instead — see `entryUpdateSetValues`.
 */
export function entryInsertValues(
  subdomain: string,
  record: JournalEntry,
): typeof accountingEntries.$inferInsert {
  return {
    id: record.id,
    workspaceSubdomain: subdomain,
    date: record.date,
    ref: record.ref ?? "",
    description: record.description ?? "",
    status: record.status ?? "posted",
    createdBy: record.created_by ?? "",
    fiscalYear: record.fiscal_year ?? "",
    fiscalYearId: record.fiscal_year_id || null,
    sourceType: record.source_type ?? null,
    sourceId: record.source_id || null,
    transactionType: record.transaction_type ?? null,
    reversedRef: record.reversed_ref ?? null,
    simpleMode: record.simple_mode ?? false,
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
    deletedBy: record.deletedBy ?? null,
    deletionReason: record.deletionReason ?? null,
    updatedAt: new Date(),
  };
}

export async function replaceEntriesForWorkspace(
  tenant: string,
  records: JournalEntry[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, JournalEntry>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(accountingEntryAttachments)
      .where(eq(accountingEntryAttachments.workspaceSubdomain, subdomain));
    await tx
      .delete(accountingEntryTags)
      .where(eq(accountingEntryTags.workspaceSubdomain, subdomain));
    await tx
      .delete(accountingJournalLines)
      .where(eq(accountingJournalLines.workspaceSubdomain, subdomain));
    await tx.delete(accountingEntries).where(eq(accountingEntries.workspaceSubdomain, subdomain));

    if (uniqueRecords.length === 0) return;

    await tx
      .insert(accountingEntries)
      .values(uniqueRecords.map((record) => entryInsertValues(subdomain, record)));

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

    const allTags = records.flatMap((record) =>
      (record.tags ?? []).map((tag) => ({
        workspaceSubdomain: subdomain,
        entryId: record.id,
        tag,
      })),
    );
    if (allTags.length > 0) {
      await tx.insert(accountingEntryTags).values(allTags);
    }

    const allAttachments = records.flatMap((record) =>
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

export async function deleteAccountingByWorkspace(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(accountingBankReconciliations)
      .where(eq(accountingBankReconciliations.workspaceSubdomain, subdomain));
    await tx
      .delete(accountingBankStatementLines)
      .where(eq(accountingBankStatementLines.workspaceSubdomain, subdomain));
    await tx
      .delete(accountingBankStatements)
      .where(eq(accountingBankStatements.workspaceSubdomain, subdomain));
    await tx
      .delete(accountingOpeningBalances)
      .where(eq(accountingOpeningBalances.workspaceSubdomain, subdomain));
    await tx
      .delete(accountingPostingRules)
      .where(eq(accountingPostingRules.workspaceSubdomain, subdomain));
    await tx
      .delete(accountingEntryAttachments)
      .where(eq(accountingEntryAttachments.workspaceSubdomain, subdomain));
    await tx
      .delete(accountingEntryTags)
      .where(eq(accountingEntryTags.workspaceSubdomain, subdomain));
    await tx
      .delete(accountingJournalLines)
      .where(eq(accountingJournalLines.workspaceSubdomain, subdomain));
    await tx.delete(accountingEntries).where(eq(accountingEntries.workspaceSubdomain, subdomain));
    await tx
      .delete(accountingFiscalYears)
      .where(eq(accountingFiscalYears.workspaceSubdomain, subdomain));
    await tx.delete(accountingAccounts).where(eq(accountingAccounts.workspaceSubdomain, subdomain));
  });
}

export async function bulkSoftDeleteEntries(
  tenant: string,
  ids: string[],
  deletedBy?: string,
  deletionReason?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(accountingEntries)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(accountingEntries.workspaceSubdomain, subdomain),
          inArray(accountingEntries.id, uniqueIds),
          isNull(accountingEntries.deletedAt),
          ne(accountingEntries.status, "posted"),
        ),
      )
      .returning({ id: accountingEntries.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

export async function bulkRestoreEntries(
  tenant: string,
  ids: string[],
  _userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    // Pre-check for conflicting active references per MMS soft-delete standard
    const candidateRows = await tx
      .select({ id: accountingEntries.id, ref: accountingEntries.ref })
      .from(accountingEntries)
      .where(
        and(
          eq(accountingEntries.workspaceSubdomain, subdomain),
          inArray(accountingEntries.id, uniqueIds),
          isNotNull(accountingEntries.deletedAt),
        ),
      );

    const nonBlankRefs = candidateRows
      .map((r) => r.ref?.trim())
      .filter((r): r is string => Boolean(r));

    if (nonBlankRefs.length > 0) {
      const activeConflicts = await tx
        .select({ id: accountingEntries.id, ref: accountingEntries.ref })
        .from(accountingEntries)
        .where(
          and(
            eq(accountingEntries.workspaceSubdomain, subdomain),
            inArray(accountingEntries.ref, nonBlankRefs),
            isNull(accountingEntries.deletedAt),
          ),
        );
      if (activeConflicts.length > 0) {
        throw new ConflictError(
          `Cannot restore journal entry: reference "${activeConflicts[0].ref}" is already used by an active entry`,
        );
      }
    }

    try {
      const updated = await tx
        .update(accountingEntries)
        .set({
          deletedAt: null,
          deletedBy: null,
          deletionReason: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(accountingEntries.workspaceSubdomain, subdomain),
            inArray(accountingEntries.id, uniqueIds),
            isNotNull(accountingEntries.deletedAt),
          ),
        )
        .returning({ id: accountingEntries.id });

      return {
        succeeded: updated.length,
        failed: uniqueIds.length - updated.length,
      };
    } catch (error) {
      const err = error as { code?: string; constraint?: string };
      if (
        err?.code === "23505" &&
        (err?.constraint === "accounting_entries_workspace_ref_active_uidx" ||
          err?.constraint?.includes("ref"))
      ) {
        throw new ConflictError(
          "Cannot restore journal entry: reference is already used by an active entry",
        );
      }
      throw error;
    }
  });
}
