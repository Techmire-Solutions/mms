import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Payment } from "@mms/shared";
import {
  financeFeeItems,
  financeFeeStructures,
  financeInvoiceLines,
  financeInvoices,
  financePaymentAllocations,
  financePayments,
} from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { requireDbDateValue } from "../../lib/dbDate.js";

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
          date: requireDbDateValue(r.date, "date"),
          method: r.method ?? "cash",
          receivedByUserId: r.receivedByUserId ?? null,
          receivedBy: r.receivedBy ?? null,
          note: r.note ?? "",
          currency: r.currency ?? null,
          exchangeRate: r.exchangeRate ?? null,
          realizedFx: r.realizedFx != null ? String(r.realizedFx) : null,
          invoiceAmount: r.invoiceAmount != null ? String(r.invoiceAmount) : null,
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
          date: requireDbDateValue(r.date, "date"),
          method: r.method ?? "cash",
          receivedByUserId: r.receivedByUserId ?? null,
          receivedBy: r.receivedBy ?? null,
          note: r.note ?? "",
          currency: r.currency ?? null,
          exchangeRate: r.exchangeRate ?? null,
          realizedFx: r.realizedFx != null ? String(r.realizedFx) : null,
          invoiceAmount: r.invoiceAmount != null ? String(r.invoiceAmount) : null,
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
