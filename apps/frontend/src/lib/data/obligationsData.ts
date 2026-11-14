export type {
  ObligationType,
  Mujtahid,
  MujtahidRep,
  WakalaType,
  ObligationDistribution,
  ObligationCollection,
  ObligationsSettings,
} from "@mms/shared";

// Aliases of the shared tuples — one source of truth (audit S2). These names are kept because the
// module's components import them from here; the values and their order come from `@mms/shared`.
export {
  OBLIGATION_DESIGNATED_FOR as DESIGNATED_FOR_OPTIONS,
  OBLIGATION_DISTRIBUTION_TYPES as DISTRIBUTION_TYPES,
  OBLIGATION_PAYMENT_MODES as PAYMENT_MODES,
} from "@mms/shared";

export {
  computeNextObligationReceiptNo as generateReceiptNo,
  formatObligationReceiptNumber,
} from "@mms/shared";
