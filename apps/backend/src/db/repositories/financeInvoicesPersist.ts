import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Invoice } from "@mms/shared";
import { financeInvoices, financePayments } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { ValidationError } from "../../lib/httpErrors.js";
import { invoiceWriteValues } from "./financeInvoiceValues.js";
import { replaceInvoiceLines } from "./financeBillingRepository.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";

/**
 * Trash/restore own the soft-delete columns, so both upsert SET lists below
 * deliberately omit `deletedAt` / `deletedBy` / `deletionReason`.
 *
 * `invoiceWriteValues` includes them (a backup restore may legitimately insert
 * an already-trashed row), but a whole-list invoice save re-sends
 * `deletedAt: null` for every active invoice it holds, and writing that through
 * meant a save in one session silently un-deleted an invoice another session
 * had trashed — or re-trashed a restored one. Soft-delete state now changes
 * only through {@link bulkSoftDeleteInvoices} / {@link bulkRestoreInvoices}.
 * This is the same parity rule as `accountingEntriesPersist.entryUpdateSetValues`.
 */
export async function saveInvoice(tenant: string, record: Invoice): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const values = invoiceWriteValues(subdomain, record);
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(financeInvoices)
      .values(values)
      .onConflictDoUpdate({
        target: [financeInvoices.workspaceSubdomain, financeInvoices.id],
        set: {
          studentId: values.studentId,
          studentName: values.studentName,
          class: values.class,
          session: values.session,
          baseFee: values.baseFee,
          discountType: values.discountType,
          discountValue: values.discountValue,
          discountAmt: values.discountAmt,
          finalAmt: values.finalAmt,
          status: values.status,
          dueDate: values.dueDate,
          paidDate: values.paidDate,
          method: values.method,
          paidAmt: values.paidAmt,
          invoiceNumber: values.invoiceNumber,
          feeStructureId: values.feeStructureId,
          billingPeriod: values.billingPeriod,
          enrollmentId: values.enrollmentId,
          familyContactId: values.familyContactId,
          lateFeeAmt: values.lateFeeAmt,
          creditedAmt: values.creditedAmt,
          lastRemindedAt: values.lastRemindedAt,
          reminderCount: values.reminderCount,
          // deletedAt / deletedBy / deletionReason are deliberately absent — see
          // invoiceUpdateSetValues above.
          updatedAt: values.updatedAt,
        },
      });
    // Lines belong to the same aggregate: writing them in a second transaction
    // left an invoice without its lines whenever the caller did not already own
    // one (payments/status updates pass no lines, updates do).
    if (record.lines) {
      await replaceInvoiceLines(tenant, record.id, record.lines);
    }
  });
  await invalidateMultiTierCache({
    tenantId: subdomain,
    domain: "finance",
    key: String(record.id),
  });
}

export async function bulkSaveInvoices(tenant: string, records: Invoice[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Invoice>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(financeInvoices)
      .values(uniqueRecords.map((r) => invoiceWriteValues(subdomain, r)))
      .onConflictDoUpdate({
        target: [financeInvoices.workspaceSubdomain, financeInvoices.id],
        set: {
          studentId: sql`excluded.student_id`,
          studentName: sql`excluded.student_name`,
          class: sql`excluded.class`,
          session: sql`excluded.session`,
          baseFee: sql`excluded.base_fee`,
          discountType: sql`excluded.discount_type`,
          discountValue: sql`excluded.discount_value`,
          discountAmt: sql`excluded.discount_amt`,
          finalAmt: sql`excluded.final_amt`,
          status: sql`excluded.status`,
          dueDate: sql`excluded.due_date`,
          paidDate: sql`excluded.paid_date`,
          method: sql`excluded.method`,
          paidAmt: sql`excluded.paid_amt`,
          invoiceNumber: sql`excluded.invoice_number`,
          feeStructureId: sql`excluded.fee_structure_id`,
          billingPeriod: sql`excluded.billing_period`,
          enrollmentId: sql`excluded.enrollment_id`,
          familyContactId: sql`excluded.family_contact_id`,
          lateFeeAmt: sql`excluded.late_fee_amt`,
          creditedAmt: sql`excluded.credited_amt`,
          lastRemindedAt: sql`excluded.last_reminded_at`,
          reminderCount: sql`excluded.reminder_count`,
          // Soft-delete columns are omitted on purpose: trash/restore own them
          // (see the note on saveInvoice).
          updatedAt: new Date(),
        },
      });
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "finance" });
}

export async function replaceInvoicesForWorkspace(
  tenant: string,
  records: Invoice[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Invoice>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(financeInvoices).where(eq(financeInvoices.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx
        .insert(financeInvoices)
        .values(uniqueRecords.map((r) => invoiceWriteValues(subdomain, r)));
    }
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "finance" });
}

/**
 * Archive one invoice. Delegates to the soft-delete path on purpose: invoices
 * carry a `forbid_hard_delete` trigger, so a hard `DELETE` could only ever
 * raise (or, under `app.allow_hard_purge`, destroy the subledger and its
 * ledger link outright). Ledger-aware archiving lives one layer up in
 * `financeRecordLifecycle.deleteInvoiceById`, which also posts the reversal.
 */
export async function deleteInvoice(
  tenant: string,
  id: string,
  deletedBy?: string,
  deletionReason?: string,
): Promise<void> {
  await bulkSoftDeleteInvoices(tenant, [id], deletedBy, deletionReason);
}

export async function bulkSoftDeleteInvoices(
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
    const activePaymentsCount = await tx.$count(
      financePayments,
      and(
        eq(financePayments.workspaceSubdomain, subdomain),
        inArray(financePayments.invoiceId, uniqueIds),
        isNull(financePayments.deletedAt),
      ),
    );
    if (activePaymentsCount > 0) {
      throw new ValidationError(
        `Cannot archive invoice with active payments (${activePaymentsCount} active payment(s) exist)`,
      );
    }

    const updated = await tx
      .update(financeInvoices)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(financeInvoices.workspaceSubdomain, subdomain),
          inArray(financeInvoices.id, uniqueIds),
          isNull(financeInvoices.deletedAt),
        ),
      )
      .returning({ id: financeInvoices.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "finance" });
  return res;
}

export async function bulkRestoreInvoices(
  tenant: string,
  ids: string[],
  userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  const res = await withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(financeInvoices)
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
          eq(financeInvoices.workspaceSubdomain, subdomain),
          inArray(financeInvoices.id, uniqueIds),
          isNotNull(financeInvoices.deletedAt),
        ),
      )
      .returning({ id: financeInvoices.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "finance" });
  return res;
}
