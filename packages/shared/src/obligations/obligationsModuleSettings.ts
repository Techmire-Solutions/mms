import type { SequenceYearFormat, SequenceRolloverPolicy } from "../core/sequenceNumberingTypes.js";

// ─── Obligations Module Settings ─────────────────────────────────────────────

export interface ObligationsSettings {
  autoGenerateReceipt?: boolean;
  receiptPrefix?: string;
  receiptYearFormat?: SequenceYearFormat;
  receiptSequenceDigits?: number;
  receiptDelimiter?: string;
  receiptStartingSequence?: number;
  receiptRolloverPolicy?: SequenceRolloverPolicy;
  receiptCurrentSequence?: number;
  defaultViewLayout?: string;
}

export const DEFAULT_OBLIGATIONS_SETTINGS: ObligationsSettings = {
  autoGenerateReceipt: true,
  receiptPrefix: "OBL",
  receiptYearFormat: "YYYY",
  receiptSequenceDigits: 5,
  receiptDelimiter: "-",
  receiptStartingSequence: 1,
  receiptRolloverPolicy: "annual_calendar",
  defaultViewLayout: "list",
};
