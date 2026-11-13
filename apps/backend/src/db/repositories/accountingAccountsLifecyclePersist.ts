import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds } from "@mms/shared";
import { accountingAccounts } from "../schema.js";
import { auditAccountLifecycle, readAccountAuditStates } from "./accountingEntityAudit.js";
import { withTenant } from "../tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { assertRestoredParentsActive } from "./accountingAccountsHierarchyPersist.js";

/**
 * Account restore, split out of `accountingAccountsPersist.ts` to keep that module
 * inside the 300-line ceiling.
 *
 * Two invariants live here because they only exist on the way back from the trash:
 * the code must be free among active accounts (it is recyclable, 0253), and a
 * restored child may not land under an archived parent (every reader filters
 * `deleted_at IS NULL`, so it would vanish from the tree).
 */
export async function bulkRestoreAccounts(
  tenant: string,
  ids: string[],
  userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const before = await readAccountAuditStates(tx, subdomain, uniqueIds);
    // Recyclable uniqueness: a code freed by the archive may have been taken by a
    // new account, so the restore is refused with the same 409 the write path uses.
    const candidates = await tx
      .select({ id: accountingAccounts.id, code: accountingAccounts.code })
      .from(accountingAccounts)
      .where(
        and(
          eq(accountingAccounts.workspaceSubdomain, subdomain),
          inArray(accountingAccounts.id, uniqueIds),
        ),
      )
      .for("update");
    const trashedCodes = candidates.map((row) => row.code.trim()).filter(Boolean);
    if (trashedCodes.length > 0) {
      const conflicts = await tx
        .select({ code: accountingAccounts.code })
        .from(accountingAccounts)
        .where(
          and(
            eq(accountingAccounts.workspaceSubdomain, subdomain),
            inArray(accountingAccounts.code, trashedCodes),
            isNull(accountingAccounts.deletedAt),
          ),
        );
      if (conflicts.length > 0) {
        throw new ConflictError(
          `Cannot restore account: code "${conflicts[0]!.code}" is already used by an active account`,
          "account_code_conflict",
        );
      }
    }

    const restored = await tx
      .update(accountingAccounts)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        // Restore attribution: the sextuple exists and every reader selects it, so a
        // restored account must record who brought it back (mms-soft-delete §5).
        restoredAt: now,
        restoredBy: userId || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(accountingAccounts.workspaceSubdomain, subdomain),
          inArray(accountingAccounts.id, uniqueIds),
          sql`${accountingAccounts.deletedAt} is not null`,
        ),
      )
      .returning({ id: accountingAccounts.id });

    if (restored.length > 0) {
      await assertRestoredParentsActive(
        tx,
        subdomain,
        restored.map((row) => row.id),
      );
      const restoredIds = new Set(restored.map((row) => row.id));
      const restoredStates = new Map([...before].filter(([id]) => restoredIds.has(id)));
      await auditAccountLifecycle(tx, subdomain, restoredStates, "restore");
    }

    return {
      succeeded: restored.length,
      failed: uniqueIds.length - restored.length,
    };
  });
}
