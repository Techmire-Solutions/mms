import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { AccountingListQuery, AccountingEntriesListPageResult } from "@mms/shared";
import {
  accountingEntries,
  accountingJournalLines,
  accountingEntryTags,
  accountingEntryAttachments,
} from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { entryRowToRecord, type JournalLineRow } from "./accountingRepository.js";
import { buildEntryListConditions, buildEntryOrderBy } from "./accountingRepositoryListQuery.js";

export async function listEntriesPage(
  tenant: string,
  query: AccountingListQuery & { afterId?: string; skipCount?: boolean },
): Promise<AccountingEntriesListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(Math.max(1, query.limit ?? 12), 500);
  const isCursorPaging = Boolean(query.afterId?.trim());
  const offset = isCursorPaging ? 0 : (page - 1) * limit;

  return withTenantRead(subdomain, async (tx) => {
    const baseConditions = buildEntryListConditions(subdomain, query);
    const baseWhereClause = and(...baseConditions);
    const conditions = [...baseConditions];
    if (isCursorPaging) {
      conditions.push(sql`${accountingEntries.id} > ${query.afterId!.trim()}`);
    }
    const whereClause = and(...conditions);
    const orderBy = isCursorPaging
      ? asc(accountingEntries.id)
      : buildEntryOrderBy(query.sortField, query.sortDir);

    let total = 0;
    if (!query.skipCount) {
      const countRows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(accountingEntries)
        .where(baseWhereClause);
      total = Number(countRows[0]?.count ?? 0);
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
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    if (rows.length === 0) {
      return {
        entries: [],
        total,
        page,
        limit,
        hasMore: false,
      };
    }

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
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      const arr = linesByEntry.get(line.entryId);
      if (arr) {
        arr.push(line);
      } else {
        linesByEntry.set(line.entryId, [line]);
      }
    }

    const tagsByEntry = new Map<string, string[]>();
    for (let i = 0; i < allTags.length; i++) {
      const t = allTags[i];
      const arr = tagsByEntry.get(t.entryId);
      if (arr) {
        arr.push(t.tag);
      } else {
        tagsByEntry.set(t.entryId, [t.tag]);
      }
    }

    const attachmentsByEntry = new Map<string, string[]>();
    for (let i = 0; i < allAttachments.length; i++) {
      const a = allAttachments[i];
      const arr = attachmentsByEntry.get(a.entryId);
      if (arr) {
        arr.push(a.url);
      } else {
        attachmentsByEntry.set(a.entryId, [a.url]);
      }
    }

    const items = rows.map((r) =>
      entryRowToRecord(
        r,
        linesByEntry.get(r.id) ?? [],
        tagsByEntry.get(r.id) ?? [],
        attachmentsByEntry.get(r.id) ?? [],
      ),
    );

    return {
      entries: items,
      total,
      page,
      limit,
      hasMore: isCursorPaging ? rows.length === limit : page * limit < total,
      ...(isCursorPaging && rows.length > 0 ? { nextCursor: rows[rows.length - 1].id } : {}),
    };
  });
}
