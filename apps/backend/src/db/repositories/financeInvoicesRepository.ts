import { and, eq, inArray, isNull } from "drizzle-orm";
import { dedupeTrimmedIds, type Invoice, type RepositoryListOptions } from "@mms/shared";
import { financeInvoiceLines, financeInvoices } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import { invoiceLineRowToRecord } from "./financeBillingRepository.js";
import { canonicalStoredRate } from "./repositoryFxMappers.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";

// Re-export persistence functions for backward compatibility
export {
  saveInvoice,
  bulkSaveInvoices,
  replaceInvoicesForWorkspace,
  deleteInvoice,
  bulkSoftDeleteInvoices,
  bulkRestoreInvoices,
} from "./financeInvoicesPersist.js";

type InvoiceRow = typeof financeInvoices.$inferSelect;

export function invoiceRowToRecord(row: InvoiceRow): Invoice {
  const invoice: Invoice = {
    id: row.id,
    studentId: row.studentId,
    studentName: row.studentName,
    class: row.class,
    session: row.session,
    baseFee: Number(row.baseFee ?? 0),
    discountType: row.discountType,
    discountValue: Number(row.discountValue ?? 0),
    discountAmt: Number(row.discountAmt ?? 0),
    finalAmt: Number(row.finalAmt ?? 0),
    status: row.status as Invoice["status"],
    dueDate: row.dueDate,
    paidDate: row.paidDate,
    method: row.method,
    ...mapAuditTimestamps(row),
  };

  if (row.paidAmt != null) invoice.paidAmt = Number(row.paidAmt);
  if (row.invoiceNumber) invoice.invoiceNumber = row.invoiceNumber;
  if (row.feeStructureId) invoice.feeStructureId = row.feeStructureId;
  if (row.billingPeriod) invoice.billingPeriod = row.billingPeriod;
  if (row.enrollmentId) invoice.enrollmentId = row.enrollmentId;
  if (row.familyContactId) invoice.familyContactId = row.familyContactId;
  if (row.lateFeeAmt != null) invoice.lateFeeAmt = Number(row.lateFeeAmt);
  if (row.creditedAmt != null) invoice.creditedAmt = Number(row.creditedAmt);
  if (row.lastRemindedAt) invoice.lastRemindedAt = row.lastRemindedAt.toISOString();
  if (row.reminderCount != null) invoice.reminderCount = row.reminderCount;
  if (row.currency) invoice.currency = row.currency;
  if (row.exchangeRate) invoice.exchangeRate = canonicalStoredRate(row.exchangeRate);

  return invoice;
}

export type ListInvoicesOptions = RepositoryListOptions;

export async function listInvoicesByWorkspace(
  tenant: string,
  options?: ListInvoicesOptions,
): Promise<Invoice[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
  return withTenantRead(subdomain, async (tx) => {
    const conditions = buildTenantSoftDeleteConditions(financeInvoices, subdomain, deletedFilter);
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
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);
    return rows.map(invoiceRowToRecord);
  });
}

export async function findInvoiceById(tenant: string, id: string): Promise<Invoice | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
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
        and(eq(financeInvoices.workspaceSubdomain, subdomain), eq(financeInvoices.id, trimmedId)),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const lineRows = await tx
      .select({
        id: financeInvoiceLines.id,
        workspaceSubdomain: financeInvoiceLines.workspaceSubdomain,
        invoiceId: financeInvoiceLines.invoiceId,
        feeItemId: financeInvoiceLines.feeItemId,
        description: financeInvoiceLines.description,
        quantity: financeInvoiceLines.quantity,
        amount: financeInvoiceLines.amount,
        discountAmt: financeInvoiceLines.discountAmt,
        createdAt: financeInvoiceLines.createdAt,
      })
      .from(financeInvoiceLines)
      .where(
        and(
          eq(financeInvoiceLines.workspaceSubdomain, subdomain),
          eq(financeInvoiceLines.invoiceId, trimmedId),
        ),
      );
    return { ...invoiceRowToRecord(row), lines: lineRows.map(invoiceLineRowToRecord) };
  });
}

export async function findInvoicesByIds(
  tenant: string,
  ids: string[],
  options?: { includeDeleted?: boolean },
): Promise<Invoice[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [
      eq(financeInvoices.workspaceSubdomain, subdomain),
      inArray(financeInvoices.id, cleanIds),
    ];
    if (!options?.includeDeleted) {
      conditions.push(isNull(financeInvoices.deletedAt));
    }
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
      .where(and(...conditions));
    return rows.map(invoiceRowToRecord);
  });
}
