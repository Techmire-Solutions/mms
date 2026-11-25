import { loadLedgerSnapshot } from "./accountingReportEndpointsRepository.js";
import { listReceivablesAging } from "./accountingReceivablesAgingRepository.js";

/** Drizzle-backed storage for the ledger and receivables-aging report endpoints. */
export const accountingReportEndpointsRepository = {
  loadLedgerSnapshot,
  listReceivablesAging,
};
