import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import {
  dedupeTrimmedIds,
  type ObligationCollection,
  type RepositoryListOptions,
} from "@mms/shared";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import { obligationCollections } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";
import {
  saveObligationCollection,
  bulkSaveObligationCollections,
  replaceObligationCollectionsForWorkspace,
  bulkSoftDeleteObligationCollections,
  bulkRestoreObligationCollections,
  deleteObligationsByWorkspace,
} from "./obligationCollectionsPersist.js";

type ObligationCollectionRow = typeof obligationCollections.$inferSelect;

export function obligationCollectionRowToRecord(
  row: ObligationCollectionRow,
): ObligationCollection {
  const collection: ObligationCollection = {
    id: row.id,
    receipt_no: row.receiptNo,
    received_date: row.receivedDate,
    sender_id: row.senderId,
    reference_id: row.referenceId ?? null,
    amount: Number(row.amount),
    currency_id: row.currencyId,
    payment_mode: row.paymentMode as ObligationCollection["payment_mode"],
    obligation_type_id: row.obligationTypeId,
    mujtahid_representative_id: row.mujtahidRepresentativeId,
    received_by: row.receivedBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    ...mapAuditTimestamps(row),
  };

  return collection;
}

export type ListObligationCollectionsOptions = RepositoryListOptions;

export async function listObligationCollectionsByWorkspace(
  tenant: string,
  options?: ListObligationCollectionsOptions,
): Promise<ObligationCollection[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 2000, 1), 10000);
  const offset = Math.max(options?.offset ?? 0, 0);
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
  return withTenantRead(subdomain, async (tx) => {
    const conditions = buildTenantSoftDeleteConditions(
      obligationCollections,
      subdomain,
      deletedFilter,
    );
    const rows = await tx
      .select({
        id: obligationCollections.id,
        workspaceSubdomain: obligationCollections.workspaceSubdomain,
        receiptNo: obligationCollections.receiptNo,
        receivedDate: obligationCollections.receivedDate,
        senderId: obligationCollections.senderId,
        referenceId: obligationCollections.referenceId,
        amount: obligationCollections.amount,
        currencyId: obligationCollections.currencyId,
        paymentMode: obligationCollections.paymentMode,
        obligationTypeId: obligationCollections.obligationTypeId,
        mujtahidRepresentativeId: obligationCollections.mujtahidRepresentativeId,
        receivedBy: obligationCollections.receivedBy,
        deletedAt: obligationCollections.deletedAt,
        deletedBy: obligationCollections.deletedBy,
        deletionReason: obligationCollections.deletionReason,
        restoredAt: obligationCollections.restoredAt,
        restoredBy: obligationCollections.restoredBy,
        deletedWithCascade: obligationCollections.deletedWithCascade,
        createdAt: obligationCollections.createdAt,
        updatedAt: obligationCollections.updatedAt,
      })
      .from(obligationCollections)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);
    return rows.map(obligationCollectionRowToRecord);
  });
}

export async function findObligationCollectionById(
  tenant: string,
  id: string,
): Promise<ObligationCollection | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: obligationCollections.id,
        workspaceSubdomain: obligationCollections.workspaceSubdomain,
        receiptNo: obligationCollections.receiptNo,
        receivedDate: obligationCollections.receivedDate,
        senderId: obligationCollections.senderId,
        referenceId: obligationCollections.referenceId,
        amount: obligationCollections.amount,
        currencyId: obligationCollections.currencyId,
        paymentMode: obligationCollections.paymentMode,
        obligationTypeId: obligationCollections.obligationTypeId,
        mujtahidRepresentativeId: obligationCollections.mujtahidRepresentativeId,
        receivedBy: obligationCollections.receivedBy,
        deletedAt: obligationCollections.deletedAt,
        deletedBy: obligationCollections.deletedBy,
        deletionReason: obligationCollections.deletionReason,
        restoredAt: obligationCollections.restoredAt,
        restoredBy: obligationCollections.restoredBy,
        deletedWithCascade: obligationCollections.deletedWithCascade,
        createdAt: obligationCollections.createdAt,
        updatedAt: obligationCollections.updatedAt,
      })
      .from(obligationCollections)
      .where(
        and(
          eq(obligationCollections.workspaceSubdomain, subdomain),
          eq(obligationCollections.id, trimmedId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? obligationCollectionRowToRecord(row) : null;
  });
}

export async function findObligationCollectionsByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<ObligationCollection[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted";
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(obligationCollections.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(obligationCollections.deletedAt)
          : isNull(obligationCollections.deletedAt);

    const conditions = [
      eq(obligationCollections.workspaceSubdomain, subdomain),
      inArray(obligationCollections.id, cleanIds),
    ];
    if (deletedCond) conditions.push(deletedCond);

    const rows = await tx
      .select({
        id: obligationCollections.id,
        workspaceSubdomain: obligationCollections.workspaceSubdomain,
        receiptNo: obligationCollections.receiptNo,
        receivedDate: obligationCollections.receivedDate,
        senderId: obligationCollections.senderId,
        referenceId: obligationCollections.referenceId,
        amount: obligationCollections.amount,
        currencyId: obligationCollections.currencyId,
        paymentMode: obligationCollections.paymentMode,
        obligationTypeId: obligationCollections.obligationTypeId,
        mujtahidRepresentativeId: obligationCollections.mujtahidRepresentativeId,
        receivedBy: obligationCollections.receivedBy,
        deletedAt: obligationCollections.deletedAt,
        deletedBy: obligationCollections.deletedBy,
        deletionReason: obligationCollections.deletionReason,
        restoredAt: obligationCollections.restoredAt,
        restoredBy: obligationCollections.restoredBy,
        deletedWithCascade: obligationCollections.deletedWithCascade,
        createdAt: obligationCollections.createdAt,
        updatedAt: obligationCollections.updatedAt,
      })
      .from(obligationCollections)
      .where(and(...conditions));
    return rows.map(obligationCollectionRowToRecord);
  });
}

export {
  saveObligationCollection,
  bulkSaveObligationCollections,
  replaceObligationCollectionsForWorkspace,
  bulkSoftDeleteObligationCollections,
  bulkRestoreObligationCollections,
  deleteObligationsByWorkspace,
};
