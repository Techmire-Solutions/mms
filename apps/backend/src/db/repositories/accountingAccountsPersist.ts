import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Account } from "@mms/shared";
import { accountingAccounts, accountingJournalLines } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { ValidationError } from "../../lib/httpErrors.js";
import {
  accountFxInsertValues,
  accountFxUpdateSet,
  applyExplicitAccountFxFlags,
} from "./accountingAccountsFxPersist.js";

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
        ...accountFxInsertValues(record),
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
          ...accountFxUpdateSet(record),
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
          ...accountFxInsertValues(r),
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
    await applyExplicitAccountFxFlags(tx, subdomain, uniqueRecords);
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
          ...accountFxInsertValues(r),
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
