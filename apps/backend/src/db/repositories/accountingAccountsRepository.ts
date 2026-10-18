import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Account } from "@mms/shared";
import { accountingAccounts, accountingEntries, accountingJournalLines } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { ValidationError } from "../../lib/httpErrors.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";

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

export async function saveAccount(tenant: string, record: Account): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(accountingAccounts)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        code: record.code,
        name: record.name,
        type: record.type,
        subtype: record.subtype ?? "",
        description: record.description ?? "",
        isActive: record.isActive ?? true,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        deletedBy: record.deletedBy ?? null,
        deletionReason: record.deletionReason ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
        set: {
          code: record.code,
          name: record.name,
          type: record.type,
          subtype: record.subtype ?? "",
          description: record.description ?? "",
          isActive: record.isActive ?? true,
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveAccounts(tenant: string, records: Account[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Account>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(accountingAccounts)
      .values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          code: r.code,
          name: r.name,
          type: r.type,
          subtype: r.subtype ?? "",
          description: r.description ?? "",
          isActive: r.isActive ?? true,
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          deletedBy: r.deletedBy ?? null,
          deletionReason: r.deletionReason ?? null,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
        set: {
          code: sql`excluded.code`,
          name: sql`excluded.name`,
          type: sql`excluded.type`,
          subtype: sql`excluded.subtype`,
          description: sql`excluded.description`,
          isActive: sql`excluded.is_active`,
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceAccountsForWorkspace(
  tenant: string,
  records: Account[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Account>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(accountingAccounts).where(eq(accountingAccounts.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(accountingAccounts).values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          code: r.code,
          name: r.name,
          type: r.type,
          subtype: r.subtype ?? "",
          description: r.description ?? "",
          isActive: r.isActive ?? true,
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          deletedBy: r.deletedBy ?? null,
          deletionReason: r.deletionReason ?? null,
          updatedAt: new Date(),
        })),
      );
    }
  });
}

export async function bulkSoftDeleteAccounts(
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
    const activeLinesCount = await tx.$count(
      accountingJournalLines,
      and(
        eq(accountingJournalLines.workspaceSubdomain, subdomain),
        inArray(accountingJournalLines.accountId, uniqueIds),
      ),
    );
    if (activeLinesCount > 0) {
      throw new ValidationError(
        `Cannot archive account with active journal lines (${activeLinesCount} active line(s) exist)`,
      );
    }

    const updated = await tx
      .update(accountingAccounts)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(accountingAccounts.workspaceSubdomain, subdomain),
          inArray(accountingAccounts.id, uniqueIds),
          isNull(accountingAccounts.deletedAt),
        ),
      )
      .returning({ id: accountingAccounts.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

export async function bulkRestoreAccounts(
  tenant: string,
  ids: string[],
  _userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(accountingAccounts)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(accountingAccounts.workspaceSubdomain, subdomain),
          inArray(accountingAccounts.id, uniqueIds),
          isNotNull(accountingAccounts.deletedAt),
        ),
      )
      .returning({ id: accountingAccounts.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

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
