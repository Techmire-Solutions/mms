import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Payment, type RepositoryListOptions } from "@mms/shared";
import {
  financeFeeItems,
  financeFeeStructures,
  financeInvoiceLines,
  financeInvoices,
  financePaymentAllocations,
  financePayments,
} from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";

type PaymentRow = typeof financePayments.$inferSelect;

export function paymentRowToRecord(row: PaymentRow): Payment {
  const payment: Payment = {
    id: row.id,
    invoiceId: row.invoiceId,
    amount: Number(row.amount ?? 0),
    date: row.date,
    method: row.method,
    note: row.note,
    ...mapAuditTimestamps(row),
  };

  if (row.studentId) payment.studentId = row.studentId;
  if (row.studentName) payment.studentName = row.studentName;
  if (row.receivedByUserId) payment.receivedByUserId = row.receivedByUserId;
  if (row.receivedBy) payment.receivedBy = row.receivedBy;

  return payment;
}

export type ListPaymentsOptions = RepositoryListOptions;

export async function listPaymentsByWorkspace(
  tenant: string,
  options?: ListPaymentsOptions,
): Promise<Payment[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
  return withTenantRead(subdomain, async (tx) => {
    const conditions = buildTenantSoftDeleteConditions(financePayments, subdomain, deletedFilter);
    const rows = await tx
      .select({
        id: financePayments.id,
        workspaceSubdomain: financePayments.workspaceSubdomain,
        invoiceId: financePayments.invoiceId,
        studentId: financePayments.studentId,
        studentName: financePayments.studentName,
        amount: financePayments.amount,
        date: financePayments.date,
        method: financePayments.method,
        receivedByUserId: financePayments.receivedByUserId,
        receivedBy: financePayments.receivedBy,
        note: financePayments.note,
        deletedAt: financePayments.deletedAt,
        deletedBy: financePayments.deletedBy,
        deletionReason: financePayments.deletionReason,
        restoredAt: financePayments.restoredAt,
        restoredBy: financePayments.restoredBy,
        deletedWithCascade: financePayments.deletedWithCascade,
        createdAt: financePayments.createdAt,
        updatedAt: financePayments.updatedAt,
      })
      .from(financePayments)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);
    return rows.map(paymentRowToRecord);
  });
}

export async function findPaymentById(tenant: string, id: string): Promise<Payment | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: financePayments.id,
        workspaceSubdomain: financePayments.workspaceSubdomain,
        invoiceId: financePayments.invoiceId,
        studentId: financePayments.studentId,
        studentName: financePayments.studentName,
        amount: financePayments.amount,
        date: financePayments.date,
        method: financePayments.method,
        receivedByUserId: financePayments.receivedByUserId,
        receivedBy: financePayments.receivedBy,
        note: financePayments.note,
        deletedAt: financePayments.deletedAt,
        deletedBy: financePayments.deletedBy,
        deletionReason: financePayments.deletionReason,
        restoredAt: financePayments.restoredAt,
        restoredBy: financePayments.restoredBy,
        deletedWithCascade: financePayments.deletedWithCascade,
        createdAt: financePayments.createdAt,
        updatedAt: financePayments.updatedAt,
      })
      .from(financePayments)
      .where(
        and(eq(financePayments.workspaceSubdomain, subdomain), eq(financePayments.id, trimmedId)),
      )
      .limit(1);
    const row = rows[0];
    return row ? paymentRowToRecord(row) : null;
  });
}

export async function findPaymentsByIds(
  tenant: string,
  ids: string[],
  options?: { includeDeleted?: boolean },
): Promise<Payment[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [
      eq(financePayments.workspaceSubdomain, subdomain),
      inArray(financePayments.id, cleanIds),
    ];
    if (!options?.includeDeleted) {
      conditions.push(isNull(financePayments.deletedAt));
    }
    const rows = await tx
      .select({
        id: financePayments.id,
        workspaceSubdomain: financePayments.workspaceSubdomain,
        invoiceId: financePayments.invoiceId,
        studentId: financePayments.studentId,
        studentName: financePayments.studentName,
        amount: financePayments.amount,
        date: financePayments.date,
        method: financePayments.method,
        receivedByUserId: financePayments.receivedByUserId,
        receivedBy: financePayments.receivedBy,
        note: financePayments.note,
        deletedAt: financePayments.deletedAt,
        deletedBy: financePayments.deletedBy,
        deletionReason: financePayments.deletionReason,
        restoredAt: financePayments.restoredAt,
        restoredBy: financePayments.restoredBy,
        deletedWithCascade: financePayments.deletedWithCascade,
        createdAt: financePayments.createdAt,
        updatedAt: financePayments.updatedAt,
      })
      .from(financePayments)
      .where(and(...conditions));
    return rows.map(paymentRowToRecord);
  });
}

export async function savePayment(tenant: string, record: Payment): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(financePayments)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        invoiceId: record.invoiceId,
        studentId: record.studentId ?? null,
        studentName: record.studentName ?? null,
        amount: String(record.amount ?? 0),
        date: record.date,
        method: record.method ?? "cash",
        receivedByUserId: record.receivedByUserId ?? null,
        receivedBy: record.receivedBy ?? null,
        note: record.note ?? "",
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        deletedBy: record.deletedBy ?? null,
        deletionReason: record.deletionReason ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [financePayments.workspaceSubdomain, financePayments.id],
        set: {
          invoiceId: record.invoiceId,
          studentId: record.studentId ?? null,
          studentName: record.studentName ?? null,
          amount: String(record.amount ?? 0),
          date: record.date,
          method: record.method ?? "cash",
          receivedByUserId: record.receivedByUserId ?? null,
          receivedBy: record.receivedBy ?? null,
          note: record.note ?? "",
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSavePayments(tenant: string, records: Payment[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Payment>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(financePayments)
      .values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          invoiceId: r.invoiceId,
          studentId: r.studentId ?? null,
          studentName: r.studentName ?? null,
          amount: String(r.amount ?? 0),
          date: r.date,
          method: r.method ?? "cash",
          receivedByUserId: r.receivedByUserId ?? null,
          receivedBy: r.receivedBy ?? null,
          note: r.note ?? "",
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          deletedBy: r.deletedBy ?? null,
          deletionReason: r.deletionReason ?? null,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [financePayments.workspaceSubdomain, financePayments.id],
        set: {
          invoiceId: sql`excluded.invoice_id`,
          studentId: sql`excluded.student_id`,
          studentName: sql`excluded.student_name`,
          amount: sql`excluded.amount`,
          date: sql`excluded.date`,
          method: sql`excluded.method`,
          receivedByUserId: sql`excluded.received_by_user_id`,
          receivedBy: sql`excluded.received_by`,
          note: sql`excluded.note`,
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replacePaymentsForWorkspace(
  tenant: string,
  records: Payment[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Payment>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(financePayments).where(eq(financePayments.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(financePayments).values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          invoiceId: r.invoiceId,
          studentId: r.studentId ?? null,
          studentName: r.studentName ?? null,
          amount: String(r.amount ?? 0),
          date: r.date,
          method: r.method ?? "cash",
          receivedByUserId: r.receivedByUserId ?? null,
          receivedBy: r.receivedBy ?? null,
          note: r.note ?? "",
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          deletedBy: r.deletedBy ?? null,
          deletionReason: r.deletionReason ?? null,
          updatedAt: new Date(),
        })),
      );
    }
  });
}

export async function deletePayment(tenant: string, id: string): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(financePayments)
      .where(and(eq(financePayments.workspaceSubdomain, subdomain), eq(financePayments.id, id)));
  });
}

export async function bulkSoftDeletePayments(
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
      .update(financePayments)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(financePayments.workspaceSubdomain, subdomain),
          inArray(financePayments.id, uniqueIds),
          isNull(financePayments.deletedAt),
        ),
      )
      .returning({ id: financePayments.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

export async function bulkRestorePayments(
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
      .update(financePayments)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(financePayments.workspaceSubdomain, subdomain),
          inArray(financePayments.id, uniqueIds),
          isNotNull(financePayments.deletedAt),
        ),
      )
      .returning({ id: financePayments.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

export async function deleteFinanceByWorkspace(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(financePaymentAllocations)
      .where(eq(financePaymentAllocations.workspaceSubdomain, subdomain));
    await tx
      .delete(financeInvoiceLines)
      .where(eq(financeInvoiceLines.workspaceSubdomain, subdomain));
    await tx.delete(financePayments).where(eq(financePayments.workspaceSubdomain, subdomain));
    await tx.delete(financeInvoices).where(eq(financeInvoices.workspaceSubdomain, subdomain));
    await tx.delete(financeFeeItems).where(eq(financeFeeItems.workspaceSubdomain, subdomain));
    await tx
      .delete(financeFeeStructures)
      .where(eq(financeFeeStructures.workspaceSubdomain, subdomain));
  });
}
