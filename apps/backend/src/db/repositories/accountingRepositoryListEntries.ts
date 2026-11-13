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
import { activeReversalEntryIdSql } from "./accountingEntriesHydrate.js";
import { buildEntryListConditions, buildEntryOrderBy } from "./accountingRepositoryListQuery.js";

interface LineSummaryRow {
  entryId: string;
  lineCount: number;
  debitTotal: string;
  creditTotal: string;
}

export async function listEntriesPage(
  tenant: string,
  query: AccountingListQuery & { afterId?: string; skipCount?: boolean },
): Promise<AccountingEntriesListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(Math.max(1, query.limit ?? 12), 500);
  const isCursorPaging = Boolean(query.afterId?.trim());
  const offset = isCursorPaging ? 0 : (page - 1) * limit;
  /**
   * Register projection: the list rows render header totals, not voucher lines,
   * so a dense voucher no longer ships its whole line set to the page. The
   * drawer reads the full entry by id. Tags/attachments stay: they are rendered
   * as row chips and are tiny compared with the lines.
   */
  const includeLines = query.includeLines !== false;

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
        activeReversalEntryId: activeReversalEntryIdSql(),
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
    const lineRows = includeLines
      ? tx
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
          )
      : Promise.resolve([] as Array<{ entryId: string } & JournalLineRow>);
    const [allLines, allTags, allAttachments, lineSummaries] = await Promise.all([
      lineRows,
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
      /**
       * Header totals for the projected list: one grouped aggregate over the
       * page's line rows instead of shipping every line.
       */
      includeLines
        ? Promise.resolve([] as LineSummaryRow[])
        : tx
            .select({
              entryId: accountingJournalLines.entryId,
              lineCount: sql<number>`count(*)::int`,
              debitTotal: sql<string>`coalesce(sum(${accountingJournalLines.debit}), 0)`,
              creditTotal: sql<string>`coalesce(sum(${accountingJournalLines.credit}), 0)`,
            })
            .from(accountingJournalLines)
            .where(
              and(
                eq(accountingJournalLines.workspaceSubdomain, subdomain),
                inArray(accountingJournalLines.entryId, entryIds),
              ),
            )
            .groupBy(accountingJournalLines.entryId),
    ]);
    const summariesByEntry = new Map(lineSummaries.map((row) => [row.entryId, row]));

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

    const items = rows.map((r) => {
      const record = entryRowToRecord(
        r,
        linesByEntry.get(r.id) ?? [],
        tagsByEntry.get(r.id) ?? [],
        attachmentsByEntry.get(r.id) ?? [],
      );
      const summary = summariesByEntry.get(r.id);
      if (!summary) return record;
      return {
        ...record,
        lineCount: Number(summary.lineCount),
        debitTotal: Math.round(Number(summary.debitTotal) * 100) / 100,
        creditTotal: Math.round(Number(summary.creditTotal) * 100) / 100,
      };
    });

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
