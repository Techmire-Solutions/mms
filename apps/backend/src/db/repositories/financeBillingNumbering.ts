/**
 * Invoice number allocation (single and batch).
 */

import { and, desc, eq, like } from "drizzle-orm";
import { formatInvoiceNumber, nextInvoiceNumber, nextInvoiceSequence } from "@mms/shared";
import { financeInvoices } from "../schema.js";
import { withTenant } from "../tenant-context.js";
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
