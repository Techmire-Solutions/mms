import { loadLedgerSnapshot } from "../../db/repositories/accountingReportEndpointsRepository.js";
import { listReceivablesAging } from "../../db/repositories/accountingReceivablesAgingRepository.js";

/** Drizzle-backed storage for the ledger and receivables-aging report endpoints. */
export const accountingReportEndpointsRepository = {
  loadLedgerSnapshot,
  listReceivablesAging,
};
