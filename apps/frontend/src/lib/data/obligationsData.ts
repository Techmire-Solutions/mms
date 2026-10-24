export type {
  ObligationType,
  Mujtahid,
  MujtahidRep,
  WakalaType,
  ObligationDistribution,
  ObligationCollection,
  ObligationsSettings,
} from "@mms/shared";

export const DESIGNATED_FOR_OPTIONS = ["Syed", "Non-Syed", "Both", "None"] as const;

export const DISTRIBUTION_TYPES = ["Liability", "Income"] as const;
export const PAYMENT_MODES = ["Cash", "Online"] as const;

export {
  computeNextObligationReceiptNo as generateReceiptNo,
  formatObligationReceiptNumber,
} from "@mms/shared";
