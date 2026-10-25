import { and, eq, inArray, isNull } from "drizzle-orm";
import { dedupeTrimmedIds, type Payment, type RepositoryListOptions } from "@mms/shared";
import { financePayments } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import { canonicalStoredRate } from "./repositoryFxMappers.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";
import { requireDbDateValue } from "../../lib/dbDate.js";

export * from "./financePaymentsPersist.js";

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
  if (row.currency) payment.currency = row.currency;
  if (row.exchangeRate) payment.exchangeRate = canonicalStoredRate(row.exchangeRate);
  if (row.realizedFx != null) payment.realizedFx = Number(row.realizedFx);
  if (row.invoiceAmount != null) payment.invoiceAmount = Number(row.invoiceAmount);

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
        currency: financePayments.currency,
        exchangeRate: financePayments.exchangeRate,
        realizedFx: financePayments.realizedFx,
        invoiceAmount: financePayments.invoiceAmount,
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
        currency: financePayments.currency,
        exchangeRate: financePayments.exchangeRate,
        realizedFx: financePayments.realizedFx,
        invoiceAmount: financePayments.invoiceAmount,
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
        currency: financePayments.currency,
        exchangeRate: financePayments.exchangeRate,
        realizedFx: financePayments.realizedFx,
        invoiceAmount: financePayments.invoiceAmount,
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
        date: requireDbDateValue(record.date, "date"),
        method: record.method ?? "cash",
        receivedByUserId: record.receivedByUserId ?? null,
        receivedBy: record.receivedBy ?? null,
        note: record.note ?? "",
        currency: record.currency ?? null,
        exchangeRate: record.exchangeRate ?? null,
        realizedFx: record.realizedFx != null ? String(record.realizedFx) : null,
        invoiceAmount: record.invoiceAmount != null ? String(record.invoiceAmount) : null,
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
          date: requireDbDateValue(record.date, "date"),
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
