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

export async function saveObligationCollection(
  tenant: string,
  record: ObligationCollection,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(obligationCollections)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        receiptNo: record.receipt_no,
        receivedDate: record.received_date,
        senderId: record.sender_id,
        referenceId: record.reference_id ?? null,
        amount: String(record.amount),
        currencyId: record.currency_id,
        paymentMode: record.payment_mode,
        obligationTypeId: record.obligation_type_id,
        mujtahidRepresentativeId: record.mujtahid_representative_id,
        receivedBy: record.received_by,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        deletedBy: record.deletedBy ?? null,
        deletionReason: record.deletionReason ?? null,
        createdAt: record.created_at ? new Date(record.created_at) : new Date(),
        updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
      })
      .onConflictDoUpdate({
        target: [obligationCollections.workspaceSubdomain, obligationCollections.id],
        set: {
          receiptNo: record.receipt_no,
          receivedDate: record.received_date,
          senderId: record.sender_id,
          referenceId: record.reference_id ?? null,
          amount: String(record.amount),
          currencyId: record.currency_id,
          paymentMode: record.payment_mode,
          obligationTypeId: record.obligation_type_id,
          mujtahidRepresentativeId: record.mujtahid_representative_id,
          receivedBy: record.received_by,
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: new Date(),
        },
      });
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

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(obligationCollections)
      .values(
        uniqueRecords.map((record) => ({
          id: record.id,
          workspaceSubdomain: subdomain,
          receiptNo: record.receipt_no,
          receivedDate: record.received_date,
          senderId: record.sender_id,
          referenceId: record.reference_id ?? null,
          amount: String(record.amount),
          currencyId: record.currency_id,
          paymentMode: record.payment_mode,
          obligationTypeId: record.obligation_type_id,
          mujtahidRepresentativeId: record.mujtahid_representative_id,
          receivedBy: record.received_by,
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          createdAt: record.created_at ? new Date(record.created_at) : new Date(),
          updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [obligationCollections.workspaceSubdomain, obligationCollections.id],
        set: {
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
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          updatedAt: new Date(),
        },
      });
  });
}

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
    await tx
      .delete(obligationCollections)
      .where(eq(obligationCollections.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(obligationCollections).values(
        uniqueRecords.map((record) => ({
          id: record.id,
          workspaceSubdomain: subdomain,
          receiptNo: record.receipt_no,
          receivedDate: record.received_date,
          senderId: record.sender_id,
          referenceId: record.reference_id ?? null,
          amount: String(record.amount),
          currencyId: record.currency_id,
          paymentMode: record.payment_mode,
          obligationTypeId: record.obligation_type_id,
          mujtahidRepresentativeId: record.mujtahid_representative_id,
          receivedBy: record.received_by,
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          createdAt: record.created_at ? new Date(record.created_at) : new Date(),
          updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
        })),
      );
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

export async function bulkRestoreObligationCollections(
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
      .update(obligationCollections)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
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

export async function deleteObligationsByWorkspace(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
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
