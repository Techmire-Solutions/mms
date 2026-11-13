import {
  findLedgerAccount,
  listLedgerLinesPage,
  listReceivablesAging,
  sumLedgerMovementCents,
  sumLedgerOpeningCents,
} from "../../db/repositories/accountingReportEndpointsRepository.js";

/** Drizzle-backed storage for the ledger and receivables-aging report endpoints. */
export const accountingReportEndpointsRepository = {
  findLedgerAccount,
  sumLedgerOpeningCents,
  sumLedgerMovementCents,
  listLedgerLinesPage,
  listReceivablesAging,
};
