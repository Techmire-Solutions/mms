import { and, desc, eq, like } from "drizzle-orm";
import {
  formatInvoiceNumber,
  isFeeFrequency,
  nextInvoiceNumber,
  nextInvoiceSequence,
  type FeeStructure,
  type InvoiceLine,
  type PaymentAllocation,
} from "@mms/shared";
import {
  financeFeeItems,
  financeFeeStructures,
  financeInvoiceLines,
  financeInvoices,
  financePaymentAllocations,
} from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

function feeStructureFromRows(
  structure: typeof financeFeeStructures.$inferSelect,
  items: Array<typeof financeFeeItems.$inferSelect>,
): FeeStructure {
  return {
    id: structure.id,
    name: structure.name,
    session: structure.session,
    className: structure.className,
    frequency: isFeeFrequency(structure.frequency) ? structure.frequency : "monthly",
    isActive: structure.isActive,
    items: items
      .filter((item) => item.structureId === structure.id)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => ({
        id: item.id,
        name: item.name,
        incomeAccountId: item.incomeAccountId,
        amount: Number(item.amount),
        sortOrder: item.sortOrder,
      })),
    createdAt: structure.createdAt.toISOString(),
    updatedAt: structure.updatedAt.toISOString(),
  };
}

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

export async function listFeeStructures(tenant: string): Promise<FeeStructure[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [structures, items] = await Promise.all([
      tx
        .select({
          id: financeFeeStructures.id,
          workspaceSubdomain: financeFeeStructures.workspaceSubdomain,
          name: financeFeeStructures.name,
          session: financeFeeStructures.session,
          className: financeFeeStructures.className,
          frequency: financeFeeStructures.frequency,
          isActive: financeFeeStructures.isActive,
          createdAt: financeFeeStructures.createdAt,
          updatedAt: financeFeeStructures.updatedAt,
        })
        .from(financeFeeStructures)
        .where(eq(financeFeeStructures.workspaceSubdomain, subdomain)),
      tx
        .select({
          id: financeFeeItems.id,
          workspaceSubdomain: financeFeeItems.workspaceSubdomain,
          structureId: financeFeeItems.structureId,
          name: financeFeeItems.name,
          incomeAccountId: financeFeeItems.incomeAccountId,
          amount: financeFeeItems.amount,
          sortOrder: financeFeeItems.sortOrder,
          createdAt: financeFeeItems.createdAt,
        })
        .from(financeFeeItems)
        .where(eq(financeFeeItems.workspaceSubdomain, subdomain)),
    ]);
    return structures.map((structure) => feeStructureFromRows(structure, items));
  });
}

export async function saveFeeStructure(tenant: string, record: FeeStructure): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(financeFeeStructures)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        name: record.name,
        session: record.session ?? "",
        className: record.className ?? "",
        frequency: record.frequency ?? "monthly",
        isActive: record.isActive ?? true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [financeFeeStructures.workspaceSubdomain, financeFeeStructures.id],
        set: {
          name: record.name,
          session: record.session ?? "",
          className: record.className ?? "",
          frequency: record.frequency ?? "monthly",
          isActive: record.isActive ?? true,
          updatedAt: new Date(),
        },
      });
    await tx
      .delete(financeFeeItems)
      .where(
        and(
          eq(financeFeeItems.workspaceSubdomain, subdomain),
          eq(financeFeeItems.structureId, record.id),
        ),
      );
    if (record.items.length > 0) {
      await tx.insert(financeFeeItems).values(
        record.items.map((item, index) => ({
          id: item.id,
          workspaceSubdomain: subdomain,
          structureId: record.id,
          name: item.name,
          incomeAccountId: item.incomeAccountId ?? null,
          amount: String(item.amount ?? 0),
          sortOrder: item.sortOrder ?? index,
        })),
      );
    }
  });
}

export async function deleteFeeStructure(tenant: string, id: string): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(financeFeeStructures)
      .where(
        and(
          eq(financeFeeStructures.workspaceSubdomain, subdomain),
          eq(financeFeeStructures.id, id),
        ),
      );
  });
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

export async function allocateNextInvoiceNumber(
  tenant: string,
  year: number,
  prefix = "INV",
  delimiter = "-",
): Promise<string> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({ invoiceNumber: financeInvoices.invoiceNumber })
      .from(financeInvoices)
      .where(
        and(
          eq(financeInvoices.workspaceSubdomain, subdomain),
          like(financeInvoices.invoiceNumber, `${prefix}${delimiter}${year}${delimiter}%`),
        ),
      )
      .orderBy(desc(financeInvoices.invoiceNumber))
      .limit(100);
    return nextInvoiceNumber(
      rows.map((row) => row.invoiceNumber).filter((value): value is string => Boolean(value)),
      year,
      prefix,
    );
  });
}

export async function allocateInvoiceNumberBatch(
  tenant: string,
  year: number,
  count: number,
  prefix = "INV",
  delimiter = "-",
): Promise<string[]> {
  if (count <= 0) return [];
  const first = await allocateNextInvoiceNumber(tenant, year, prefix, delimiter);
  const start = nextInvoiceSequence([first], year, prefix) - 1;
  return Array.from({ length: count }, (_, index) =>
    formatInvoiceNumber(year, start + index, prefix),
  );
}
