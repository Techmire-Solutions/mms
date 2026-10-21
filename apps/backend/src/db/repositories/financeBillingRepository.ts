/**
 * Finance billing repository facade.
 *
 * Decomposed into modular units (ADR-001):
 * - `financeBillingFeeStructures.ts`: fee structures and their fee items.
 * - `financeBillingInvoiceLines.ts`: invoice lines and payment allocations.
 * - `financeBillingNumbering.ts`: invoice number allocation.
 */
export {
  listFeeStructures,
  saveFeeStructure,
  deleteFeeStructure,
} from "./financeBillingFeeStructures.js";
export {
  invoiceLineRowToRecord,
  paymentAllocationRowToRecord,
  listInvoiceLines,
  replaceInvoiceLines,
  replacePaymentAllocations,
} from "./financeBillingInvoiceLines.js";
export {
  allocateNextInvoiceNumber,
  allocateInvoiceNumberBatch,
} from "./financeBillingNumbering.js";
