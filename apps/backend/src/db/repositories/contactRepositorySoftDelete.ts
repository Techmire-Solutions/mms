import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { dedupeTrimmedIds } from "@mms/shared";
import { contacts } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";

export async function bulkSoftDeleteContactsSql(
  tenant: string,
  ids: string[],
  deletedBy?: string,
  deletionReason?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  const res = await withTenant(subdomain, async (tx) => {
    // `deleted_at` participates in the RLS policy's USING clause, so the new row
    // fails the policy check unless archived rows are visible in this transaction
    // (migration 0200's RESTRICTIVE soft-delete policy has no separate WITH CHECK).
    await enableIncludeDeleted(tx);
    const updated = await tx
      .update(contacts)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(contacts.workspaceSubdomain, subdomain),
          inArray(contacts.id, uniqueIds),
          isNull(contacts.deletedAt),
        ),
      )
      .returning({ id: contacts.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "contacts" });
  return res;
}

export async function bulkRestoreContactsSql(
  tenant: string,
  ids: string[],
  userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  const res = await withTenant(subdomain, async (tx) => {
    // Same RLS reasoning as soft-delete: restoring (deleted_at → NULL) mutates a
    // row the restrictive policy would otherwise hide, so opt in for this tx.
    await enableIncludeDeleted(tx);
    const updated = await tx
      .update(contacts)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        restoredBy: userId || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(contacts.workspaceSubdomain, subdomain),
          inArray(contacts.id, uniqueIds),
          isNotNull(contacts.deletedAt),
        ),
      )
      .returning({ id: contacts.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "contacts" });
  return res;
}
