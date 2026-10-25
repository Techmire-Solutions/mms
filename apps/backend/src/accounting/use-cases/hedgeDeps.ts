import { activeDb } from "../../db/dbConnection.js";
import { accountingHedgesRepository as store } from "../repository/accountingHedgesRepositoryAdapter.js";
import { accountingFxRepository } from "../repository/accountingFxRepositoryAdapter.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import {
  entryForSource,
  persistGeneratedEntry,
  resolveYearId,
} from "../ledgerPosting/ledgerPostingHelpers.js";
import type { HedgeDeps } from "./hedgeUseCases.js";

/** Production wiring: callers run inside one tenant transaction, so entries, records and audit commit together. */
export const hedgeDeps: HedgeDeps = {
  fx: accountingFxRepository,
  store,
  postEntry: (tenant, entry) => persistGeneratedEntry(tenant, entry),
  buildEntry: async (tenant, sourceType, sourceId, date, description, lines) => {
    const years = await store.listFiscalYearsByWorkspace(tenant);
    return entryForSource(sourceType, sourceId, date, description, lines, resolveYearId(years, date));
  },
  recordAudit: (input) => recordModernAuditEvent(activeDb(), input),
};
