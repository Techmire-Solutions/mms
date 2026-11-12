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

export async function listOpenInvoicesForCollect(
  tenant: string,
  options?: { forUpdate?: boolean },
): Promise<Invoice[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const query = tx
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
        currency: financeInvoices.currency,
        exchangeRate: financeInvoices.exchangeRate,
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
    // Row-lock the candidates when late fees are about to be decided: a concurrent
    // payment/credit must not settle an invoice between the check and the write.
    const locked = options?.forUpdate ? await query.for("update") : await query;
    return locked.map(invoiceRowToRecord);
  });
}

/**
 * Applies late fees and returns only the rows that actually received one.
 *
 * The conditional `late_fee_amt <= 0` + open-status guard makes concurrent
 * collectors (two schedulers, a retried job, a duplicate API call) mutually
 * exclusive: the second UPDATE matches nothing instead of overwriting a fee that
 * was already posted, and a payment that settled the invoice in the meantime
 * excludes it. Callers must post journals and audit rows for the returned rows
 * only.
 */
export async function applyLateFeeAmounts(
  tenant: string,
  fees: readonly { invoiceId: string; amount: number }[],
): Promise<Array<{ invoiceId: string; amount: number }>> {
  if (fees.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const result = await tx.execute(sql`
      UPDATE ${financeInvoices}
      SET late_fee_amt = CASE ${sql.join(
        fees.map(
          (fee) =>
            sql`WHEN ${financeInvoices.id} = ${fee.invoiceId} THEN ${String(fee.amount)}::numeric`,
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
        AND ${financeInvoices.lateFeeAmt} <= 0
        AND ${financeInvoices.status} IN ('pending', 'partial', 'overdue')
      RETURNING ${financeInvoices.id} AS id, ${financeInvoices.lateFeeAmt} AS late_fee_amt
    `);
    return (result.rows as Array<{ id: string; late_fee_amt: string | null }>).map((row) => ({
      invoiceId: row.id,
      amount: Number(row.late_fee_amt ?? 0),
    }));
  });
}

/**
 * Claims invoices for a reminder and returns only the ids this caller won.
 *
 * The 24 h guard is part of the UPDATE, so two concurrent reminder runs (or a
 * retried job) cannot both decide to notify the same invoice: the loser matches
 * zero rows and must not send. Mirrors `wasRemindedRecently` in `@mms/shared`.
 */
export async function claimInvoicesForReminder(
  tenant: string,
  invoiceIds: string[],
): Promise<string[]> {
  const cleanIds = dedupeTrimmedIds(invoiceIds);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const claimed = await tx
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
          sql`(${financeInvoices.lastRemindedAt} IS NULL OR ${financeInvoices.lastRemindedAt} < now() - interval '24 hours')`,
        ),
      )
      .returning({ id: financeInvoices.id });
    return claimed.map((row) => row.id);
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
        currency: financeInvoices.currency,
        exchangeRate: financeInvoices.exchangeRate,
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
