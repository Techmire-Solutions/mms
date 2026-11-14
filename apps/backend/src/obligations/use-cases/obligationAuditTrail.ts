/**
 * @file obligationAuditTrail.ts
 * @description Same-transaction audit rows (and outbox events) for obligation mutations.
 *
 * The module audited its *ledger* postings but never its own records: a receipt could be created,
 * re-amounted or archived with no actor, no before/after and no reason in `audit_trail_events`
 * (security audit A1). Every helper here is called from inside the transaction that performs the
 * mutation, so `recordModernAuditEvent` appends to the sharded hash chain with the write — an audit
 * append that fails rolls the mutation back (the `auditAtomicityDb` pattern).
 *
 * The actor comes from the request context; background callers (workspace purge) record `null`
 * rather than inventing an id.
 */
import type { ObligationCollection, ObligationDistribution, WakalaType } from "@mms/shared";
import { getRequestUserId } from "../../lib/tenantContext.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { emitOutboxEvents } from "../../services/outboxEventService.js";

const TABLE = "obligation_collections";

/** The audit action a save represents, and whether anything actually changed. */
function changedFields(previous: ObligationCollection, next: ObligationCollection): string[] {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (key === "updated_at") continue;
    const before = (previous as Record<string, unknown>)[key];
    const after = (next as Record<string, unknown>)[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(key);
  }
  return changed;
}

/** One `CREATE` or `UPDATE` row for a saved receipt. A no-op save writes nothing. */
export async function auditCollectionSaved(
  tenant: string,
  previous: ObligationCollection | null,
  next: ObligationCollection,
): Promise<void> {
  if (previous) {
    const changed = changedFields(previous, next);
    if (changed.length === 0) return;
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: TABLE,
      recordId: next.id,
      actionType: "UPDATE",
      realUserId: getRequestUserId(),
      oldState: previous,
      newState: { ...next, changedFields: changed },
      // Keep the changed keys so the stored delta is a readable before/after diff.
      minimizeDelta: true,
    });
    return;
  }
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: TABLE,
    recordId: next.id,
    actionType: "CREATE",
    realUserId: getRequestUserId(),
    newState: next,
    minimizeDelta: false,
  });
}

/** A forensic text snapshot that survives the retention hard-purge of the row. */
function forensicSnapshot(record: ObligationCollection): Record<string, unknown> {
  return {
    receipt_no: record.receipt_no,
    received_date: record.received_date,
    sender_id: record.sender_id,
    amount: record.amount,
    currency_id: record.currency_id,
    payment_mode: record.payment_mode,
    obligation_type_id: record.obligation_type_id,
    mujtahid_representative_id: record.mujtahid_representative_id,
    received_by: record.received_by,
    reference_id: record.reference_id ?? null,
  };
}

/**
 * `DELETE` rows plus `entity.soft_deleted` outbox events for an archive.
 *
 * The deletion reason travels through both: it is the justification the compliance trail needs, and
 * it is the only justification this module records at all (`captureDeletionReason` was `false`).
 */
export async function auditCollectionsDeleted(
  tenant: string,
  rows: readonly ObligationCollection[],
  options: { deletedBy: string; reason?: string } = { deletedBy: "system" },
): Promise<void> {
  if (rows.length === 0) return;
  for (const record of rows) {
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: TABLE,
      recordId: record.id,
      actionType: "DELETE",
      realUserId: getRequestUserId() ?? options.deletedBy,
      oldState: record,
      newState: {
        deletedAt: record.deletedAt ?? null,
        deletedBy: record.deletedBy ?? options.deletedBy,
        deletionReason: record.deletionReason ?? options.reason ?? null,
        ...(options.reason ? { reason: options.reason } : {}),
      },
      minimizeDelta: false,
    });
  }
  await emitOutboxEvents(
    rows.map((record) => ({
      type: "entity.soft_deleted" as const,
      payload: {
        entityType: TABLE,
        entityId: record.id,
        tenantId: tenant,
        deletedAt: record.deletedAt ?? new Date().toISOString(),
        deletedBy: record.deletedBy ?? options.deletedBy,
        ...((record.deletionReason ?? options.reason)
          ? { deletionReason: record.deletionReason ?? options.reason }
          : {}),
        version: Date.now(),
        snapshot: forensicSnapshot(record),
      },
    })),
  );
}

/** `RESTORE` rows plus `entity.restored` outbox events for a trash recovery. */
export async function auditCollectionsRestored(
  tenant: string,
  rows: readonly { collection: ObligationCollection; archivedAt: string }[],
  restoredBy: string | null,
): Promise<void> {
  if (rows.length === 0) return;
  for (const { collection, archivedAt } of rows) {
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: TABLE,
      recordId: collection.id,
      actionType: "RESTORE",
      realUserId: getRequestUserId(),
      oldState: { deletedAt: archivedAt, deletedBy: collection.deletedBy ?? null },
      newState: { deletedAt: null, restoredBy, archivedAt },
      minimizeDelta: false,
    });
  }
  await emitOutboxEvents(
    rows.map(({ collection }) => ({
      type: "entity.restored" as const,
      payload: {
        entityType: TABLE,
        entityId: collection.id,
        tenantId: tenant,
        restoredAt: new Date().toISOString(),
        restoredBy: restoredBy ?? "system",
        version: Date.now(),
      },
    })),
  );
}

/** One `UPDATE` row per catalogue change: which ids were removed and which were written. */
export async function auditCatalogueReplaced(
  tenant: string,
  tableName:
    | "obligation_types"
    | "mujtahids"
    | "mujtahid_reps"
    | "wakala_types"
    | "obligation_distributions",
  existingIds: readonly string[],
  writtenIds: readonly string[],
): Promise<void> {
  const keep = new Set(writtenIds);
  const removedIds = existingIds.filter((id) => !keep.has(id));
  const createdIds = writtenIds.filter((id) => !existingIds.includes(id));
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName,
    recordId: tenant,
    actionType: "UPDATE",
    realUserId: getRequestUserId(),
    newState: {
      operation: "catalogue_replaced",
      writtenCount: writtenIds.length,
      createdIds,
      // Removal is the destructive half — it cascades to wakalas and split rules.
      removedIds,
    },
    minimizeDelta: false,
  });
}

/** The wakala aggregate: one row for the wakala set and one per distribution rule set. */
export async function auditWakalaAggregate(
  tenant: string,
  previousWakalaIds: readonly string[],
  previousDistributionIds: readonly string[],
  wakalaTypes: readonly WakalaType[],
  distributions: readonly ObligationDistribution[],
): Promise<void> {
  await auditCatalogueReplaced(
    tenant,
    "wakala_types",
    previousWakalaIds,
    wakalaTypes.map((record) => record.id),
  );
  await auditCatalogueReplaced(
    tenant,
    "obligation_distributions",
    previousDistributionIds,
    distributions.map((record) => record.id),
  );
}

/** Workspace purge: the rows are physically removed, so the audit is the only record left. */
export async function auditObligationsPurged(
  tenant: string,
  counts: Record<string, number>,
): Promise<void> {
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: TABLE,
    recordId: tenant,
    actionType: "DELETE",
    realUserId: getRequestUserId(),
    newState: { operation: "workspace_purge", ...counts },
    minimizeDelta: false,
  });
}
