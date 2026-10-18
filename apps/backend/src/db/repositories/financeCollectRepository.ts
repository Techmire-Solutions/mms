import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type CreditNote, type Invoice } from "@mms/shared";
import { financeCreditNotes, financeInvoices } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { invoiceRowToRecord } from "./financeInvoicesRepository.js";

const OPEN_STATUSES = ["pending", "overdue", "partial"] as const;

export async function markOverdueInvoices(tenant: string, today: string): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(financeInvoices)
      .set({ status: "overdue", updatedAt: new Date() })
      .where(
        and(
          eq(financeInvoices.workspaceSubdomain, subdomain),
          isNull(financeInvoices.deletedAt),
          inArray(financeInvoices.status, ["pending", "partial"]),
          sql`${financeInvoices.dueDate} < ${today}`,
        ),
      )
      .returning({ id: financeInvoices.id });
    return updated.length;
  });
}

export async function listOpenInvoicesForCollect(tenant: string): Promise<Invoice[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: financeInvoices.id,
        workspaceSubdomain: financeInvoices.workspaceSubdomain,
        studentId: financeInvoices.studentId,
        studentName: financeInvoices.studentName,
        class: financeInvoices.class,
        session: financeInvoices.session,
        baseFee: financeInvoices.baseFee,
        discountType: financeInvoices.discountType,
        discountValue: financeInvoices.discountValue,
        discountAmt: financeInvoices.discountAmt,
        finalAmt: financeInvoices.finalAmt,
        status: financeInvoices.status,
        dueDate: financeInvoices.dueDate,
        paidDate: financeInvoices.paidDate,
        method: financeInvoices.method,
        paidAmt: financeInvoices.paidAmt,
        invoiceNumber: financeInvoices.invoiceNumber,
        feeStructureId: financeInvoices.feeStructureId,
        billingPeriod: financeInvoices.billingPeriod,
        enrollmentId: financeInvoices.enrollmentId,
        familyContactId: financeInvoices.familyContactId,
        lateFeeAmt: financeInvoices.lateFeeAmt,
        creditedAmt: financeInvoices.creditedAmt,
        lastRemindedAt: financeInvoices.lastRemindedAt,
        reminderCount: financeInvoices.reminderCount,
        deletedAt: financeInvoices.deletedAt,
        deletedBy: financeInvoices.deletedBy,
        deletionReason: financeInvoices.deletionReason,
        restoredAt: financeInvoices.restoredAt,
        restoredBy: financeInvoices.restoredBy,
        deletedWithCascade: financeInvoices.deletedWithCascade,
        createdAt: financeInvoices.createdAt,
        updatedAt: financeInvoices.updatedAt,
      })
      .from(financeInvoices)
      .where(
        and(
          eq(financeInvoices.workspaceSubdomain, subdomain),
          isNull(financeInvoices.deletedAt),
          inArray(financeInvoices.status, [...OPEN_STATUSES]),
        ),
      )
      .limit(100);
    return rows.map(invoiceRowToRecord);
  });
}

export async function applyLateFeeAmounts(
  tenant: string,
  fees: readonly { invoiceId: string; amount: number }[],
): Promise<void> {
  if (fees.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.execute(sql`
      UPDATE ${financeInvoices}
      SET late_fee_amt = CASE ${sql.join(
        fees.map(
          (fee) => sql`WHEN ${financeInvoices.id} = ${fee.invoiceId} THEN ${String(fee.amount)}`,
        ),
        sql` `,
      )} END,
      updated_at = now()
      WHERE ${financeInvoices.workspaceSubdomain} = ${subdomain}
        AND ${financeInvoices.id} IN (${sql.join(
          fees.map((fee) => sql`${fee.invoiceId}`),
          sql`, `,
        )})
        AND ${financeInvoices.deletedAt} IS NULL
    `);
  });
}

export async function markInvoicesReminded(tenant: string, invoiceIds: string[]): Promise<void> {
  const cleanIds = dedupeTrimmedIds(invoiceIds);
  if (cleanIds.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .update(financeInvoices)
      .set({
        lastRemindedAt: new Date(),
        reminderCount: sql`${financeInvoices.reminderCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(financeInvoices.workspaceSubdomain, subdomain),
          isNull(financeInvoices.deletedAt),
          inArray(financeInvoices.id, cleanIds),
        ),
      );
  });
}

export async function listCreditNotesForInvoice(
  tenant: string,
  invoiceId: string,
): Promise<CreditNote[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: financeCreditNotes.id,
        invoiceId: financeCreditNotes.invoiceId,
        amount: financeCreditNotes.amount,
        reason: financeCreditNotes.reason,
        createdAt: financeCreditNotes.createdAt,
      })
      .from(financeCreditNotes)
      .where(
        and(
          eq(financeCreditNotes.workspaceSubdomain, subdomain),
          eq(financeCreditNotes.invoiceId, invoiceId),
        ),
      );
    return rows.map((row) => ({
      id: row.id,
      invoiceId: row.invoiceId,
      amount: Number(row.amount),
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function saveCreditNote(tenant: string, note: CreditNote): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.insert(financeCreditNotes).values({
      id: note.id,
      workspaceSubdomain: subdomain,
      invoiceId: note.invoiceId,
      amount: String(note.amount),
      reason: note.reason ?? "",
      updatedAt: new Date(),
    });
  });
}

export async function listInvoicesByIds(tenant: string, invoiceIds: string[]): Promise<Invoice[]> {
  const cleanIds = dedupeTrimmedIds(invoiceIds).slice(0, 100);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: financeInvoices.id,
        workspaceSubdomain: financeInvoices.workspaceSubdomain,
        studentId: financeInvoices.studentId,
        studentName: financeInvoices.studentName,
        class: financeInvoices.class,
        session: financeInvoices.session,
        baseFee: financeInvoices.baseFee,
        discountType: financeInvoices.discountType,
        discountValue: financeInvoices.discountValue,
        discountAmt: financeInvoices.discountAmt,
        finalAmt: financeInvoices.finalAmt,
        status: financeInvoices.status,
        dueDate: financeInvoices.dueDate,
        paidDate: financeInvoices.paidDate,
        method: financeInvoices.method,
        paidAmt: financeInvoices.paidAmt,
        invoiceNumber: financeInvoices.invoiceNumber,
        feeStructureId: financeInvoices.feeStructureId,
        billingPeriod: financeInvoices.billingPeriod,
        enrollmentId: financeInvoices.enrollmentId,
        familyContactId: financeInvoices.familyContactId,
        lateFeeAmt: financeInvoices.lateFeeAmt,
        creditedAmt: financeInvoices.creditedAmt,
        lastRemindedAt: financeInvoices.lastRemindedAt,
        reminderCount: financeInvoices.reminderCount,
        deletedAt: financeInvoices.deletedAt,
        deletedBy: financeInvoices.deletedBy,
        deletionReason: financeInvoices.deletionReason,
        restoredAt: financeInvoices.restoredAt,
        restoredBy: financeInvoices.restoredBy,
        deletedWithCascade: financeInvoices.deletedWithCascade,
        createdAt: financeInvoices.createdAt,
        updatedAt: financeInvoices.updatedAt,
      })
      .from(financeInvoices)
      .where(
        and(
          eq(financeInvoices.workspaceSubdomain, subdomain),
          isNull(financeInvoices.deletedAt),
          inArray(financeInvoices.id, cleanIds),
        ),
      );
    return rows.map(invoiceRowToRecord);
  });
}
