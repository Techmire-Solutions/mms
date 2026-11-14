import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type ObligationCollection } from "@mms/shared";
import {
  obligationCollections,
  obligationDistributions,
  obligationTypes,
  wakalaTypes,
  mujtahidReps,
  mujtahids,
} from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { getRequestUserId } from "../../lib/tenantContext.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { requireDbDateValue } from "../../lib/dbDate.js";
import { ConflictError } from "../../lib/httpErrors.js";

/**
 * Optimistic-concurrency predicate for the upsert: write only when the caller's token still
 * matches the stored version. `excluded.version` is the token the request carried, so a stale
 * save matches nothing instead of overwriting the winner.
 */
const COLLECTION_VERSION_MATCH = sql`${obligationCollections.version} = excluded.version`;

/**
 * The editable surface of a collection, shared by the single and bulk save paths.
 *
 * `deleted_at` / `deleted_by` / `deletion_reason` are deliberately **absent**: a save must never
 * be able to archive or resurrect a receipt. Archiving and restoring have their own endpoints,
 * and each posts the matching ledger lifecycle entry — a bulk upsert that cleared `deleted_at`
 * used to resurrect an archived receipt and then post a *second* reversal of the same original
 * entry, leaving the tenant's ledger negative for a receipt the UI showed as received.
 */
const COLLECTION_UPSERT_SET = {
  receiptNo: sql`excluded.receipt_no`,
  receivedDate: sql`excluded.received_date`,
  senderId: sql`excluded.sender_id`,
  referenceId: sql`excluded.reference_id`,
  amount: sql`excluded.amount`,
  currencyId: sql`excluded.currency_id`,
  paymentMode: sql`excluded.payment_mode`,
  obligationTypeId: sql`excluded.obligation_type_id`,
  mujtahidRepresentativeId: sql`excluded.mujtahid_representative_id`,
  receivedBy: sql`excluded.received_by`,
  version: sql`${obligationCollections.version} + 1`,
  updatedAt: sql`now()`,
};

function collectionInsertValues(record: ObligationCollection, subdomain: string) {
  return {
    id: record.id,
    workspaceSubdomain: subdomain,
    receiptNo: record.receipt_no,
    receivedDate: requireDbDateValue(record.received_date, "received_date"),
    senderId: record.sender_id,
    referenceId: record.reference_id ?? null,
    amount: String(record.amount),
    currencyId: record.currency_id,
    paymentMode: record.payment_mode,
    obligationTypeId: record.obligation_type_id,
    mujtahidRepresentativeId: record.mujtahid_representative_id,
    receivedBy: record.received_by,
    // Inserts start at 1; a supplied token is only meaningful against an existing row.
    version: record.version ?? 1,
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
    deletedBy: record.deletedBy ?? null,
    deletionReason: record.deletionReason ?? null,
    createdAt: record.created_at ? new Date(record.created_at) : new Date(),
    updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
  };
}

/** 409 for a save whose token no longer matches the stored row. */
function staleCollectionWriteError(id: string): ConflictError {
  return new ConflictError(
    `Obligation collection ${id} was changed by someone else — reload and retry`,
    "stale_write",
    { id },
  );
}

export async function saveObligationCollection(
  tenant: string,
  record: ObligationCollection,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const expectedVersion = record.version;
  await withTenant(subdomain, async (tx) => {
    const written = await tx
      .insert(obligationCollections)
      .values(collectionInsertValues(record, subdomain))
      .onConflictDoUpdate({
        target: [obligationCollections.workspaceSubdomain, obligationCollections.id],
        set: COLLECTION_UPSERT_SET,
        // No token keeps the legacy last-write-wins path (offline replays and imports).
        ...(expectedVersion !== undefined ? { setWhere: COLLECTION_VERSION_MATCH } : {}),
      })
      .returning({ id: obligationCollections.id });
    if (expectedVersion !== undefined && written.length === 0) {
      throw staleCollectionWriteError(record.id);
    }
  });
}

export async function bulkSaveObligationCollections(
  tenant: string,
  records: ObligationCollection[],
): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, ObligationCollection>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;
  // One statement cannot mix token-guarded and unguarded rows: the predicate compares every
  // row against `excluded.version`, so an omitted token would read as 1 and silently skip the
  // update. Guard the whole batch only when the caller supplied a token for every row.
  const withToken = uniqueRecords.every((record) => record.version !== undefined);

  await withTenant(subdomain, async (tx) => {
    const written = await tx
      .insert(obligationCollections)
      .values(uniqueRecords.map((record) => collectionInsertValues(record, subdomain)))
      .onConflictDoUpdate({
        target: [obligationCollections.workspaceSubdomain, obligationCollections.id],
        set: COLLECTION_UPSERT_SET,
        ...(withToken ? { setWhere: COLLECTION_VERSION_MATCH } : {}),
      })
      .returning({ id: obligationCollections.id });

    if (!withToken) return;
    if (written.length === uniqueRecords.length) return;
    const skipped = new Set(uniqueRecords.map((record) => record.id));
    for (const row of written) skipped.delete(row.id);
    throw staleCollectionWriteError([...skipped][0] ?? uniqueRecords[0]!.id);
  });
}

/**
 * Replaces a workspace's collections wholesale (backup restore).
 *
 * This is an administrative overwrite, not a user delete, so it opts into the hard-purge escape
 * hatch the `forbid_hard_delete` trigger requires — the same GUC the workspace wipe uses.
 */
export async function replaceObligationCollectionsForWorkspace(
  tenant: string,
  records: ObligationCollection[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, ObligationCollection>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx
      .delete(obligationCollections)
      .where(eq(obligationCollections.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx
        .insert(obligationCollections)
        .values(uniqueRecords.map((record) => collectionInsertValues(record, subdomain)));
    }
  });
}

export async function bulkSoftDeleteObligationCollections(
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
    const updated = await tx
      .update(obligationCollections)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        version: sql`${obligationCollections.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(obligationCollections.workspaceSubdomain, subdomain),
          inArray(obligationCollections.id, uniqueIds),
          isNull(obligationCollections.deletedAt),
        ),
      )
      .returning({ id: obligationCollections.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

/**
 * Restores archived collections.
 *
 * `restored_at` / `restored_by` were added by 0108 and never written, so trash recovery left no
 * provenance; and the archive reversal is keyed on the `deletedAt` this call clears, which is why
 * the caller snapshots it first.
 */
export async function bulkRestoreObligationCollections(
  tenant: string,
  ids: string[],
  userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(obligationCollections)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        restoredBy: userId ?? null,
        version: sql`${obligationCollections.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(obligationCollections.workspaceSubdomain, subdomain),
          inArray(obligationCollections.id, uniqueIds),
          isNotNull(obligationCollections.deletedAt),
        ),
      )
      .returning({ id: obligationCollections.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

/**
 * Hard-purges a workspace's obligations (workspace wipe).
 *
 * `obligation_collections` carries `trg_obligation_collections_forbid_hard_delete`, which raises
 * unless the transaction opts in. Without the GUC this threw on any workspace that had receipts.
 */
// Hard purge. No production caller: restore/wipe replaces via `relationalReplaceMapping`.
export async function deleteObligationsByWorkspace(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    // Count before the delete: the rows are physically removed, so the audit row is the only
    // remaining record of what the purge destroyed (security audit A4).
    const [counts] = await tx
      .select({
        collections: sql<number>`count(*)::int`,
      })
      .from(obligationCollections)
      .where(eq(obligationCollections.workspaceSubdomain, subdomain));
    const [distributionCounts] = await tx
      .select({ distributions: sql<number>`count(*)::int` })
      .from(obligationDistributions)
      .where(eq(obligationDistributions.workspaceSubdomain, subdomain));
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "obligation_collections",
      recordId: subdomain,
      actionType: "DELETE",
      realUserId: getRequestUserId(),
      newState: {
        operation: "workspace_purge",
        collections: Number(counts?.collections ?? 0),
        distributions: Number(distributionCounts?.distributions ?? 0),
      },
      minimizeDelta: false,
    });
    await tx
      .delete(obligationCollections)
      .where(eq(obligationCollections.workspaceSubdomain, subdomain));
    await tx
      .delete(obligationDistributions)
      .where(eq(obligationDistributions.workspaceSubdomain, subdomain));
    await tx.delete(wakalaTypes).where(eq(wakalaTypes.workspaceSubdomain, subdomain));
    await tx.delete(mujtahidReps).where(eq(mujtahidReps.workspaceSubdomain, subdomain));
    await tx.delete(mujtahids).where(eq(mujtahids.workspaceSubdomain, subdomain));
    await tx.delete(obligationTypes).where(eq(obligationTypes.workspaceSubdomain, subdomain));
  });
}
