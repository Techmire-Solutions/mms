import { formatDeterministicSequence } from "../core/sequenceNumberingUtils.js";
import { obligationsSettingsToSequenceConfig } from "../core/sequenceNumberingAdapters.js";
import type { ObligationsSettings } from "./obligationsModuleSettings.js";

export interface ObligationCollectionReceiptRecord {
  receipt_no?: string | null;
}

/** Formats a deterministic obligation receipt number using tenant configuration. */
export function formatObligationReceiptNumber(
  sequenceNumber: number,
  settings?: Partial<ObligationsSettings>,
  referenceDate?: Date | string,
): string {
  const config = obligationsSettingsToSequenceConfig(settings);
  return formatDeterministicSequence(sequenceNumber, config, referenceDate);
}

/** Computes next receipt number from existing collections and tenant configuration. */
export function computeNextObligationReceiptNo(
  existingCollections: ObligationCollectionReceiptRecord[],
  settings?: Partial<ObligationsSettings>,
  referenceDate?: Date | string,
): string {
  const config = obligationsSettingsToSequenceConfig(settings);
  if (!config.autoGenerate) {
    return "";
  }

  const numbers = existingCollections
    .map((collection) => {
      if (!collection.receipt_no) return NaN;
      const match = collection.receipt_no.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : NaN;
    })
    .filter((receiptNumber) => !isNaN(receiptNumber));

  const maxExisting = numbers.length > 0 ? Math.max(...numbers) : 0;
  const starting = config.startingSequence || 1;
  const nextSeq = Math.max(maxExisting + 1, starting);

  return formatDeterministicSequence(nextSeq, config, referenceDate);
}

/** Alias matching frontend naming convention for backward-compatibility. */
export const generateNextObligationReceiptNo = computeNextObligationReceiptNo;
