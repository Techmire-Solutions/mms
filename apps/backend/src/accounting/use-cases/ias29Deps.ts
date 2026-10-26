import { activeDb } from "../../db/dbConnection.js";
import { accountingHyperinflationRepository as store } from "../repository/accountingHyperinflationRepositoryAdapter.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import {
  entryForSource,
  persistGeneratedEntry,
  resolveYearId,
} from "../ledgerPosting/ledgerPostingHelpers.js";
import type { Ias29Deps } from "./ias29UseCases.js";

/** Production wiring: callers run inside one tenant transaction, so entries, run and audit commit together. */
export const ias29Deps: Ias29Deps = {
  store,
  postEntry: (tenant, entry) => persistGeneratedEntry(tenant, entry),
  buildEntry: async (tenant, sourceType, sourceId, date, description, lines) => {
    const years = await store.listFiscalYearsByWorkspace(tenant);
    return entryForSource(
      sourceType,
      sourceId,
      date,
      description,
      lines,
      resolveYearId(years, date),
    );
  },
  recordAudit: (input) => recordModernAuditEvent(activeDb(), input),
};
