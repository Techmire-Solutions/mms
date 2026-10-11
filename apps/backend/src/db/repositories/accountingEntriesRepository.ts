import { and, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { dedupeTrimmedIds, type JournalEntry } from "@mms/shared";
import {
  accountingEntries,
  accountingJournalLines,
  accountingEntryTags,
  accountingEntryAttachments,
} from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";

type EntryRow = typeof accountingEntries.$inferSelect;

export type JournalLineRow = Pick<
  typeof accountingJournalLines.$inferSelect,
  "id" | "accountId"
> & {
  debit?: string | number | null;
  credit?: string | number | null;
  description?: string | null;
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

export async function listEntriesByWorkspace(
  tenant: string,
  options?: {
    deleted?: "active" | "deleted" | "all";
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<JournalEntry[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted";
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(accountingEntries.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(accountingEntries.deletedAt)
          : isNull(accountingEntries.deletedAt);

    const conditions = [eq(accountingEntries.workspaceSubdomain, subdomain)];
    if (deletedCond) conditions.push(deletedCond);

    const rows = await tx
      .select({
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
      })
      .from(accountingEntries)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);
    if (rows.length === 0) return [];

    const entryIds = rows.map((r) => r.id);
    const [allLines, allTags, allAttachments] = await Promise.all([
      tx
        .select({
          id: accountingJournalLines.id,
          entryId: accountingJournalLines.entryId,
          accountId: accountingJournalLines.accountId,
          debit: accountingJournalLines.debit,
          credit: accountingJournalLines.credit,
          description: accountingJournalLines.description,
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

    return rows.map((r) =>
      entryRowToRecord(
        r,
        linesByEntry.get(r.id) ?? [],
        tagsByEntry.get(r.id) ?? [],
        attachmentsByEntry.get(r.id) ?? [],
      ),
    );
  });
}

export async function findEntryById(tenant: string, id: string): Promise<JournalEntry | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
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
      })
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

    const [lines, tags, attachments] = await Promise.all([
      tx
        .select({
          id: accountingJournalLines.id,
          entryId: accountingJournalLines.entryId,
          accountId: accountingJournalLines.accountId,
          debit: accountingJournalLines.debit,
          credit: accountingJournalLines.credit,
          description: accountingJournalLines.description,
        })
        .from(accountingJournalLines)
        .where(
          and(
            eq(accountingJournalLines.workspaceSubdomain, subdomain),
            eq(accountingJournalLines.entryId, trimmedId),
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
            eq(accountingEntryTags.entryId, trimmedId),
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
            eq(accountingEntryAttachments.entryId, trimmedId),
          ),
        ),
    ]);

    return entryRowToRecord(
      row,
      lines,
      tags.map((t) => t.tag),
      attachments.map((a) => a.url),
    );
  });
}

export async function findEntriesByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<JournalEntry[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted";
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(accountingEntries.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(accountingEntries.deletedAt)
          : isNull(accountingEntries.deletedAt);

    const conditions = [
      eq(accountingEntries.workspaceSubdomain, subdomain),
      inArray(accountingEntries.id, cleanIds),
    ];
    if (deletedCond) conditions.push(deletedCond);

    const rows = await tx
      .select({
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
      })
      .from(accountingEntries)
      .where(and(...conditions));
    if (rows.length === 0) return [];

    const foundIds = rows.map((r) => r.id);
    const [allLines, allTags, allAttachments] = await Promise.all([
      tx
        .select({
          id: accountingJournalLines.id,
          entryId: accountingJournalLines.entryId,
          accountId: accountingJournalLines.accountId,
          debit: accountingJournalLines.debit,
          credit: accountingJournalLines.credit,
          description: accountingJournalLines.description,
        })
        .from(accountingJournalLines)
        .where(
          and(
            eq(accountingJournalLines.workspaceSubdomain, subdomain),
            inArray(accountingJournalLines.entryId, foundIds),
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
            inArray(accountingEntryTags.entryId, foundIds),
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
            inArray(accountingEntryAttachments.entryId, foundIds),
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

    return rows.map((r) =>
      entryRowToRecord(
        r,
        linesByEntry.get(r.id) ?? [],
        tagsByEntry.get(r.id) ?? [],
        attachmentsByEntry.get(r.id) ?? [],
      ),
    );
  });
}

export async function findEntryIdBySource(
  tenant: string,
  sourceType: string,
  sourceId: string,
): Promise<string | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: accountingEntries.id })
      .from(accountingEntries)
      .where(
        and(
          eq(accountingEntries.workspaceSubdomain, subdomain),
          eq(accountingEntries.sourceType, sourceType),
          eq(accountingEntries.sourceId, sourceId),
          isNull(accountingEntries.deletedAt),
        ),
      )
      .limit(1);
    return rows[0]?.id ?? null;
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
      .select({
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
      })
      .from(accountingEntries)
      .where(and(...conditions))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const [lines, tags, attachments] = await Promise.all([
      tx
        .select({
          id: accountingJournalLines.id,
          entryId: accountingJournalLines.entryId,
          accountId: accountingJournalLines.accountId,
          debit: accountingJournalLines.debit,
          credit: accountingJournalLines.credit,
          description: accountingJournalLines.description,
        })
        .from(accountingJournalLines)
        .where(
          and(
            eq(accountingJournalLines.workspaceSubdomain, subdomain),
            eq(accountingJournalLines.entryId, row.id),
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
            eq(accountingEntryTags.entryId, row.id),
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
            eq(accountingEntryAttachments.entryId, row.id),
          ),
        ),
    ]);

    return entryRowToRecord(
      row,
      lines,
      tags.map((t) => t.tag),
      attachments.map((a) => a.url),
    );
  });
}

export async function findActiveEntryRefs(
  tenant: string,
  refs: readonly string[],
): Promise<Map<string, string>> {
  const cleanRefs = refs.map((r) => r?.trim()).filter((r): r is string => Boolean(r));
  const resultMap = new Map<string, string>();
  if (cleanRefs.length === 0) return resultMap;

  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: accountingEntries.id, ref: accountingEntries.ref })
      .from(accountingEntries)
      .where(
        and(
          eq(accountingEntries.workspaceSubdomain, subdomain),
          inArray(accountingEntries.ref, cleanRefs),
          isNull(accountingEntries.deletedAt),
        ),
      );

    for (const row of rows) {
      resultMap.set(row.ref, row.id);
    }
    return resultMap;
  });
}
