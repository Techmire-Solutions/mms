import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import type { JournalEntry } from "@mms/shared";
import {
  accountingEntries,
  accountingJournalLines,
  accountingEntryTags,
  accountingEntryAttachments,
} from "../schema.js";
import { withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";
import {
  journalLineFxColumns,
  journalLineFxToRecord,
  type JournalLineFxRow,
} from "./accountingJournalLineFx.js";

export type EntryRow = typeof accountingEntries.$inferSelect;

export type JournalLineRow = Pick<
  typeof accountingJournalLines.$inferSelect,
  "id" | "accountId"
> & {
  debit?: string | number | null;
  credit?: string | number | null;
  description?: string | null;
} & JournalLineFxRow;

export const accountingEntrySelectFields = {
  id: accountingEntries.id,
  workspaceSubdomain: accountingEntries.workspaceSubdomain,
  date: accountingEntries.date,
  ref: accountingEntries.ref,
  description: accountingEntries.description,
  status: accountingEntries.status,
  createdBy: accountingEntries.createdBy,
  fiscalYear: accountingEntries.fiscalYear,
  fiscalYearId: accountingEntries.fiscalYearId,
  sourceType: accountingEntries.sourceType,
  sourceId: accountingEntries.sourceId,
  transactionType: accountingEntries.transactionType,
  reversedRef: accountingEntries.reversedRef,
  simpleMode: accountingEntries.simpleMode,
  deletedAt: accountingEntries.deletedAt,
  deletedBy: accountingEntries.deletedBy,
  deletionReason: accountingEntries.deletionReason,
  restoredAt: accountingEntries.restoredAt,
  restoredBy: accountingEntries.restoredBy,
  deletedWithCascade: accountingEntries.deletedWithCascade,
  createdAt: accountingEntries.createdAt,
  updatedAt: accountingEntries.updatedAt,
};

export function entryRowToRecord(
  row: EntryRow,
  lines: JournalLineRow[] = [],
  tags: string[] = [],
  attachments: string[] = [],
): JournalEntry {
  const entry: JournalEntry = {
    id: row.id,
    date: row.date,
    ref: row.ref,
    description: row.description,
    status: row.status as JournalEntry["status"],
    created_by: row.createdBy,
    fiscal_year: row.fiscalYear,
    simple_mode: row.simpleMode,
    lines: lines.map((l) => ({
      id: l.id,
      account_id: l.accountId,
      debit: Number(l.debit ?? 0),
      credit: Number(l.credit ?? 0),
      description: l.description ?? "",
      ...journalLineFxToRecord(l),
    })),
    tags,
    attachments,
    ...mapAuditTimestamps(row),
  };

  if (row.fiscalYearId) entry.fiscal_year_id = row.fiscalYearId;
  if (row.sourceType) entry.source_type = row.sourceType as JournalEntry["source_type"];
  if (row.sourceId) entry.source_id = row.sourceId;
  if (row.transactionType) entry.transaction_type = row.transactionType;
  if (row.reversedRef) entry.reversed_ref = row.reversedRef;

  return entry;
}

export async function fetchEntriesChildrenTx(
  tx: TenantTransaction,
  subdomain: string,
  entryIds: string[],
): Promise<{
  linesByEntry: Map<string, JournalLineRow[]>;
  tagsByEntry: Map<string, string[]>;
  attachmentsByEntry: Map<string, string[]>;
}> {
  if (entryIds.length === 0) {
    return {
      linesByEntry: new Map(),
      tagsByEntry: new Map(),
      attachmentsByEntry: new Map(),
    };
  }

  const [allLines, allTags, allAttachments] = await Promise.all([
    tx
      .select({
        id: accountingJournalLines.id,
        entryId: accountingJournalLines.entryId,
        accountId: accountingJournalLines.accountId,
        debit: accountingJournalLines.debit,
        credit: accountingJournalLines.credit,
        description: accountingJournalLines.description,
        ...journalLineFxColumns,
      })
      .from(accountingJournalLines)
      .where(
        and(
          eq(accountingJournalLines.workspaceSubdomain, subdomain),
          inArray(accountingJournalLines.entryId, entryIds),
        ),
      ),
    tx
      .select({
        entryId: accountingEntryTags.entryId,
        tag: accountingEntryTags.tag,
      })
      .from(accountingEntryTags)
      .where(
        and(
          eq(accountingEntryTags.workspaceSubdomain, subdomain),
          inArray(accountingEntryTags.entryId, entryIds),
        ),
      ),
    tx
      .select({
        entryId: accountingEntryAttachments.entryId,
        url: accountingEntryAttachments.url,
      })
      .from(accountingEntryAttachments)
      .where(
        and(
          eq(accountingEntryAttachments.workspaceSubdomain, subdomain),
          inArray(accountingEntryAttachments.entryId, entryIds),
        ),
      ),
  ]);

  const linesByEntry = new Map<string, JournalLineRow[]>();
  for (const line of allLines) {
    const arr = linesByEntry.get(line.entryId) ?? [];
    arr.push(line);
    linesByEntry.set(line.entryId, arr);
  }

  const tagsByEntry = new Map<string, string[]>();
  for (const tag of allTags) {
    const arr = tagsByEntry.get(tag.entryId) ?? [];
    arr.push(tag.tag);
    tagsByEntry.set(tag.entryId, arr);
  }

  const attachmentsByEntry = new Map<string, string[]>();
  for (const att of allAttachments) {
    const arr = attachmentsByEntry.get(att.entryId) ?? [];
    arr.push(att.url);
    attachmentsByEntry.set(att.entryId, arr);
  }

  return { linesByEntry, tagsByEntry, attachmentsByEntry };
}

export async function findEntryById(tenant: string, id: string): Promise<JournalEntry | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(accountingEntrySelectFields)
      .from(accountingEntries)
      .where(
        and(
          eq(accountingEntries.workspaceSubdomain, subdomain),
          eq(accountingEntries.id, trimmedId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const { linesByEntry, tagsByEntry, attachmentsByEntry } = await fetchEntriesChildrenTx(
      tx,
      subdomain,
      [row.id],
    );

    return entryRowToRecord(
      row,
      linesByEntry.get(row.id) ?? [],
      tagsByEntry.get(row.id) ?? [],
      attachmentsByEntry.get(row.id) ?? [],
    );
  });
}

export async function findEntryByRef(
  tenant: string,
  ref: string,
  options?: { excludeId?: string },
): Promise<JournalEntry | null> {
  const trimmedRef = ref?.trim();
  if (!trimmedRef) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [
      eq(accountingEntries.workspaceSubdomain, subdomain),
      eq(accountingEntries.ref, trimmedRef),
      isNull(accountingEntries.deletedAt),
    ];
    if (options?.excludeId?.trim()) {
      conditions.push(ne(accountingEntries.id, options.excludeId.trim()));
    }
    const rows = await tx
      .select(accountingEntrySelectFields)
      .from(accountingEntries)
      .where(and(...conditions))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const { linesByEntry, tagsByEntry, attachmentsByEntry } = await fetchEntriesChildrenTx(
      tx,
      subdomain,
      [row.id],
    );

    return entryRowToRecord(
      row,
      linesByEntry.get(row.id) ?? [],
      tagsByEntry.get(row.id) ?? [],
      attachmentsByEntry.get(row.id) ?? [],
    );
  });
}
