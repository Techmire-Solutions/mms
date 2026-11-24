import { eq } from "drizzle-orm";
import {
  normalizeObligationsModulePreferences,
  obligationsSettingsToSequenceConfig,
  type SequenceNumberingConfig,
} from "@mms/contracts";
import {
  obligationCollections,
  obligationModulePreferences,
  obligationReceiptCounters,
} from "@mms/db/schema";
import type { TenantTransaction } from "@mms/db/context";
import { allocateSequenceNumbers } from "./sequenceNumberAllocator.js";

/** Reads the receipt-numbering config inside the write transaction, or `null` when auto-numbering is off. */
async function readConfig(
  tx: TenantTransaction,
  subdomain: string,
): Promise<SequenceNumberingConfig | null> {
  const [row] = await tx
    .select({ preferences: obligationModulePreferences.preferences })
    .from(obligationModulePreferences)
    .where(eq(obligationModulePreferences.workspaceSubdomain, subdomain))
    .limit(1);
  const config = obligationsSettingsToSequenceConfig(
    normalizeObligationsModulePreferences(row?.preferences ?? null),
  );
  return config.autoGenerate ? config : null;
}

/**
 * Issues `count` receipt numbers for the period `date` falls in, or `null` when
 * automatic receipt numbering is off. Must run inside the receipt write transaction.
 */
export async function allocateObligationReceiptNumbers(
  tenant: string,
  options: { date?: string; count?: number; reserved?: ReadonlySet<string> } = {},
): Promise<string[] | null> {
  return allocateSequenceNumbers(
    tenant,
    {
      label: "receipt",
      counterTable: obligationReceiptCounters,
      docTable: obligationCollections,
      docNumberColumn: obligationCollections.receiptNo,
      readConfig,
    },
    options,
  );
}
