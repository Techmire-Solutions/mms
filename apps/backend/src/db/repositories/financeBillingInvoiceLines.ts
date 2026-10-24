/**
 * Invoice lines and payment allocations: row mappers and replace-set writes.
 */

import { and, eq } from "drizzle-orm";
import { type InvoiceLine, type PaymentAllocation } from "@mms/shared";
import { financeInvoiceLines, financePaymentAllocations } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
export function invoiceLineRowToRecord(row: typeof financeInvoiceLines.$inferSelect): InvoiceLine {
  return {
    id: row.id,
    feeItemId: row.feeItemId,
    description: row.description,
    quantity: Number(row.quantity),
    amount: Number(row.amount),
    discountAmt: Number(row.discountAmt),
  };
}
export function paymentAllocationRowToRecord(
  row: typeof financePaymentAllocations.$inferSelect,
): PaymentAllocation {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    invoiceLineId: row.invoiceLineId,
    amount: Number(row.amount),
  };
}
export async function listInvoiceLines(tenant: string, invoiceId: string): Promise<InvoiceLine[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
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
          eq(financeInvoiceLines.invoiceId, invoiceId),
        ),
      );
    return rows.map(invoiceLineRowToRecord);
  });
}
export async function replaceInvoiceLines(
  tenant: string,
  invoiceId: string,
  lines: InvoiceLine[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(financeInvoiceLines)
      .where(
        and(
          eq(financeInvoiceLines.workspaceSubdomain, subdomain),
          eq(financeInvoiceLines.invoiceId, invoiceId),
        ),
      );
    if (lines.length === 0) return;
    await tx.insert(financeInvoiceLines).values(
      lines.map((line) => ({
        id: line.id,
        workspaceSubdomain: subdomain,
        invoiceId,
        feeItemId: line.feeItemId ?? null,
        description: line.description ?? "",
        quantity: String(line.quantity ?? 1),
        amount: String(line.amount ?? 0),
        discountAmt: String(line.discountAmt ?? 0),
      })),
    );
  });
}
export async function replacePaymentAllocations(
  tenant: string,
  paymentId: string,
  allocations: PaymentAllocation[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(financePaymentAllocations)
      .where(
        and(
          eq(financePaymentAllocations.workspaceSubdomain, subdomain),
          eq(financePaymentAllocations.paymentId, paymentId),
        ),
      );
    if (allocations.length === 0) return;
    await tx.insert(financePaymentAllocations).values(
      allocations.map((allocation) => ({
        id: allocation.id,
        workspaceSubdomain: subdomain,
        paymentId,
        invoiceId: allocation.invoiceId,
        invoiceLineId: allocation.invoiceLineId ?? null,
        amount: String(allocation.amount),
      })),
    );
  });
}
