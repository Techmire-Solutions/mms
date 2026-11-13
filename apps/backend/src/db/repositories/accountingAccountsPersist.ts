import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Account } from "@mms/shared";
import { accountingAccounts } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { ValidationError, PolicyViolationError } from "../../lib/httpErrors.js";
import {
  accountFxInsertValues,
  accountFxUpdateSet,
  applyExplicitAccountFxFlags,
} from "./accountingAccountsFxPersist.js";
import {
  applyExplicitAccountParents,
  mapAccountUniqueError,
} from "./accountingAccountsHierarchyPersist.js";
import {
  assertAccountHierarchyAllowed,
  assertAccountsFresh,
  assertAccountsNotConfigured,
} from "./accountingAccountGuards.js";
import { postedLineCountsByAccount } from "./accountingAccountLedgerLines.js";
import {
  auditAccountLifecycle,
  auditAccountSaves,
  readAccountAuditStates,
} from "./accountingEntityAudit.js";

/**
 * Single-record account upsert.
 *
 * Soft-delete columns are part of the INSERT values (a backup restore may bring a
 * row back already trashed) but never of the UPDATE set: trash/restore own those
 * transitions. Writing them from the payload meant a whole-list save in one session
 * silently un-deleted an account another session had archived — the exact defect
 * fixed for journal entries in `entryUpdateSetValues`.
 */
export async function saveAccount(tenant: string, record: Account): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const before = await readAccountAuditStates(tx, subdomain, [record.id]);
    await assertAccountsFresh(tx, subdomain, [record]);
    await assertAccountHierarchyAllowed(tx, subdomain, [record]);
    const now = new Date();
    try {
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
          parentAccountId: record.parentId ?? null,
          ...accountFxInsertValues(record),
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: now,
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
            parentAccountId:
              record.parentId === undefined
                ? sql`${accountingAccounts.parentAccountId}`
                : record.parentId,
            ...accountFxUpdateSet(record),
            updatedAt: now,
          },
        });
    } catch (error) {
      mapAccountUniqueError(error);
    }
    // Hand the caller the token its next save must echo.
    record.updatedAt = now.toISOString();
    await auditAccountSaves(tx, subdomain, [record], before);
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
    const before = await readAccountAuditStates(
      tx,
      subdomain,
      uniqueRecords.map((record) => record.id),
    );
    await assertAccountsFresh(tx, subdomain, uniqueRecords);
    await assertAccountHierarchyAllowed(tx, subdomain, uniqueRecords);
    const now = new Date();
    try {
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
            parentAccountId: r.parentId ?? null,
            ...accountFxInsertValues(r),
            deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
            deletedBy: r.deletedBy ?? null,
            deletionReason: r.deletionReason ?? null,
            updatedAt: now,
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
            updatedAt: now,
          },
        });
    } catch (error) {
      mapAccountUniqueError(error);
    }
    // The parent link is only applied for records that carry it explicitly, so a
    // partial payload cannot detach a branch; same for the IAS 21 flags.
    await applyExplicitAccountParents(tx, subdomain, uniqueRecords);
    await applyExplicitAccountFxFlags(tx, subdomain, uniqueRecords);
    const iso = now.toISOString();
    for (const record of uniqueRecords) record.updatedAt = iso;
    await auditAccountSaves(tx, subdomain, uniqueRecords, before);
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
          parentAccountId: r.parentId ?? null,
          ...accountFxInsertValues(r),
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          deletedBy: r.deletedBy ?? null,
          deletionReason: r.deletionReason ?? null,
          restoredAt: r.restoredAt ? new Date(r.restoredAt) : null,
          restoredBy: r.restoredBy ?? null,
          updatedAt: new Date(),
        })),
      );
    }
  });
}

/** Trash/restore live in `accountingAccountsLifecyclePersist.ts` (300-line ceiling). */
export { bulkRestoreAccounts } from "./accountingAccountsLifecyclePersist.js";

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
    const before = await readAccountAuditStates(tx, subdomain, uniqueIds);
    // Lock the workspace's accounts, then count the ledger lines that protect them
    // under the same transaction — the previous read ran on the replica and counted
    // draft/trashed lines, so a bulk archive disagreed with single delete. The lock is
    // also what stops a concurrent archive of the same branch interleaving with the
    // children check below.
    const rows = await tx
      .select({
        id: accountingAccounts.id,
        parentAccountId: accountingAccounts.parentAccountId,
        deletedAt: accountingAccounts.deletedAt,
      })
      .from(accountingAccounts)
      .where(eq(accountingAccounts.workspaceSubdomain, subdomain))
      .for("update");

    const counts = await postedLineCountsByAccount(tx, subdomain, uniqueIds);
    const blocked = [...counts.entries()].filter(([, count]) => count > 0);
    if (blocked.length > 0) {
      const [accountId, count] = blocked[0]!;
      throw new ValidationError(
        `Cannot archive account ${accountId} with active journal lines (${count} posted line(s) exist)`,
      );
    }
    await assertAccountsNotConfigured(tx, subdomain, uniqueIds);

    // A parent with active children cannot be archived: every reader filters
    // `deleted_at IS NULL`, so the branch would disappear from the tree and the next
    // save of a child would be rejected as `archived_parent`. Archived together in one
    // call is fine — the id set is what decides.
    const archived = new Set(uniqueIds);
    const orphaned = rows.filter(
      (row) =>
        !row.deletedAt &&
        !archived.has(row.id) &&
        row.parentAccountId != null &&
        archived.has(row.parentAccountId),
    );
    if (orphaned.length > 0) {
      throw new PolicyViolationError(
        `Cannot archive a parent account while it still has active children (${orphaned
          .map((row) => row.id)
          .join(", ")})`,
        "account_has_children",
        { parentIds: uniqueIds, childIds: orphaned.map((row) => row.id) },
      );
    }

    const updated = await tx
      .update(accountingAccounts)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        restoredAt: null,
        restoredBy: null,
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

    // Archive is a COA mutation: actor + reason + the archived state go on the audit
    // chain with the soft delete (same transaction, so a failed append rolls back).
    const archivedIds = new Set(updated.map((row) => row.id));
    const archivedStates = new Map([...before].filter(([id]) => archivedIds.has(id)));
    await auditAccountLifecycle(tx, subdomain, archivedStates, "archive", deletionReason);

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}
