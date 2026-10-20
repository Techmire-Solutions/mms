import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Account } from "@mms/shared";
import { accountingAccounts, accountingEntries, accountingJournalLines } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import {
  saveAccount,
  bulkSaveAccounts,
  replaceAccountsForWorkspace,
  bulkSoftDeleteAccounts,
  bulkRestoreAccounts,
} from "./accountingAccountsPersist.js";

type AccountRow = typeof accountingAccounts.$inferSelect;

export function accountRowToRecord(row: AccountRow): Account {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type as Account["type"],
    subtype: row.subtype,
    description: row.description,
    isActive: row.isActive,
    ...mapAuditTimestamps(row),
  };
}

export async function listAccountsByWorkspace(
  tenant: string,
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<Account[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const filter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
    const conditions = buildTenantSoftDeleteConditions(accountingAccounts, subdomain, filter);

    const rows = await tx
      .select({
        id: accountingAccounts.id,
        workspaceSubdomain: accountingAccounts.workspaceSubdomain,
        code: accountingAccounts.code,
        name: accountingAccounts.name,
        type: accountingAccounts.type,
        subtype: accountingAccounts.subtype,
        description: accountingAccounts.description,
        isActive: accountingAccounts.isActive,
        deletedAt: accountingAccounts.deletedAt,
        deletedBy: accountingAccounts.deletedBy,
        deletionReason: accountingAccounts.deletionReason,
        restoredAt: accountingAccounts.restoredAt,
        restoredBy: accountingAccounts.restoredBy,
        deletedWithCascade: accountingAccounts.deletedWithCascade,
        createdAt: accountingAccounts.createdAt,
        updatedAt: accountingAccounts.updatedAt,
      })
      .from(accountingAccounts)
      .where(and(...conditions));
    return rows.map(accountRowToRecord);
  });
}

export async function findAccountById(tenant: string, id: string): Promise<Account | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: accountingAccounts.id,
        workspaceSubdomain: accountingAccounts.workspaceSubdomain,
        code: accountingAccounts.code,
        name: accountingAccounts.name,
        type: accountingAccounts.type,
        subtype: accountingAccounts.subtype,
        description: accountingAccounts.description,
        isActive: accountingAccounts.isActive,
        deletedAt: accountingAccounts.deletedAt,
        deletedBy: accountingAccounts.deletedBy,
        deletionReason: accountingAccounts.deletionReason,
        restoredAt: accountingAccounts.restoredAt,
        restoredBy: accountingAccounts.restoredBy,
        deletedWithCascade: accountingAccounts.deletedWithCascade,
        createdAt: accountingAccounts.createdAt,
        updatedAt: accountingAccounts.updatedAt,
      })
      .from(accountingAccounts)
      .where(
        and(
          eq(accountingAccounts.workspaceSubdomain, subdomain),
          eq(accountingAccounts.id, trimmedId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? accountRowToRecord(row) : null;
  });
}

export async function findAccountsByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<Account[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const filter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
    const conditions = [
      ...buildTenantSoftDeleteConditions(accountingAccounts, subdomain, filter),
      inArray(accountingAccounts.id, cleanIds),
    ];

    const rows = await tx
      .select({
        id: accountingAccounts.id,
        workspaceSubdomain: accountingAccounts.workspaceSubdomain,
        code: accountingAccounts.code,
        name: accountingAccounts.name,
        type: accountingAccounts.type,
        subtype: accountingAccounts.subtype,
        description: accountingAccounts.description,
        isActive: accountingAccounts.isActive,
        deletedAt: accountingAccounts.deletedAt,
        deletedBy: accountingAccounts.deletedBy,
        deletionReason: accountingAccounts.deletionReason,
        restoredAt: accountingAccounts.restoredAt,
        restoredBy: accountingAccounts.restoredBy,
        deletedWithCascade: accountingAccounts.deletedWithCascade,
        createdAt: accountingAccounts.createdAt,
        updatedAt: accountingAccounts.updatedAt,
      })
      .from(accountingAccounts)
      .where(and(...conditions));
    return rows.map(accountRowToRecord);
  });
}

export {
  saveAccount,
  bulkSaveAccounts,
  replaceAccountsForWorkspace,
  bulkSoftDeleteAccounts,
  bulkRestoreAccounts,
};

export async function countActiveJournalLinesForAccount(
  tenant: string,
  accountId: string,
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanAccountId = accountId?.trim();
  if (!cleanAccountId) return 0;
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(accountingJournalLines)
      .innerJoin(
        accountingEntries,
        and(
          eq(accountingJournalLines.workspaceSubdomain, accountingEntries.workspaceSubdomain),
          eq(accountingJournalLines.entryId, accountingEntries.id),
        ),
      )
      .where(
        and(
          eq(accountingJournalLines.workspaceSubdomain, subdomain),
          eq(accountingJournalLines.accountId, cleanAccountId),
          isNull(accountingEntries.deletedAt),
          // Posted only: drafts are not in the ledger, so an account referenced
          // solely by an unbalanced draft must stay archivable. Drafts that
          // reference an archived account are rejected when they are posted.
          eq(accountingEntries.status, "posted"),
        ),
      );
    return Number(result[0]?.count ?? 0);
  });
}

export async function countActiveJournalLinesForAccounts(
  tenant: string,
  accountIds: string[],
): Promise<Map<string, number>> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanIds = dedupeTrimmedIds(accountIds);
  const map = new Map<string, number>();
  if (cleanIds.length === 0) return map;
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        accountId: accountingJournalLines.accountId,
        count: sql<number>`count(*)::int`,
      })
      .from(accountingJournalLines)
      .innerJoin(
        accountingEntries,
        and(
          eq(accountingJournalLines.workspaceSubdomain, accountingEntries.workspaceSubdomain),
          eq(accountingJournalLines.entryId, accountingEntries.id),
        ),
      )
      .where(
        and(
          eq(accountingJournalLines.workspaceSubdomain, subdomain),
          inArray(accountingJournalLines.accountId, cleanIds),
          isNull(accountingEntries.deletedAt),
          // Posted only — see countActiveJournalLinesForAccount.
          eq(accountingEntries.status, "posted"),
        ),
      )
      .groupBy(accountingJournalLines.accountId);
    for (const r of rows) {
      map.set(r.accountId, Number(r.count));
    }
    return map;
  });
}
