/**
 * Invoice number allocation (single and batch) — server-authoritative.
 *
 * Replaces the `LIKE … ORDER BY DESC LIMIT 100` scan, which raced under concurrency and
 * honoured only the prefix while the Setup screen exposed the full sequence config.
 * Counters are seeded lazily from existing invoice numbers on first allocation.
 */

import { eq } from "drizzle-orm";
import {
  financeSettingsToSequenceConfig,
  normalizeFinanceModulePreferences,
  type SequenceNumberingConfig,
} from "@mms/contracts";
import { financeInvoiceCounters, financeInvoices, financeModulePreferences } from "@mms/db/schema";
import type { TenantTransaction } from "@mms/db/context";
import { allocateSequenceNumbers } from "./sequenceNumberAllocator.js";

/** Reads the invoice-numbering config inside the write transaction. Unlike other modules,
 * invoice numbers are always assigned when absent — `autoGenerateInvoice` governs invoice
 * *creation*, not numbering — so this never returns `null`. */
async function readConfig(
  tx: TenantTransaction,
  subdomain: string,
): Promise<SequenceNumberingConfig | null> {
  const [row] = await tx
    .select({ preferences: financeModulePreferences.preferences })
    .from(financeModulePreferences)
    .where(eq(financeModulePreferences.workspaceSubdomain, subdomain))
    .limit(1);
  return financeSettingsToSequenceConfig(
    normalizeFinanceModulePreferences(row?.preferences ?? null),
  );
}

/**
 * Issues `count` invoice numbers for the period `date` falls in. Must run inside the
 * invoice write transaction: the counter row stays locked until commit, and a rollback
 * returns the numbers.
 */
export async function allocateInvoiceNumbers(
  tenant: string,
  options: { date?: string; count?: number; reserved?: ReadonlySet<string> } = {},
): Promise<string[]> {
  const allocated = await allocateSequenceNumbers(
    tenant,
    {
      label: "invoice",
      counterTable: financeInvoiceCounters,
      docTable: financeInvoices,
      docNumberColumn: financeInvoices.invoiceNumber,
      readConfig,
    },
    options,
  );
  return allocated ?? [];
}
