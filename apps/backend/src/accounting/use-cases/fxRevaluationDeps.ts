import { activeDb } from "../../db/dbConnection.js";
import { accountingFxRevaluationRepository as store } from "../repository/accountingFxRevaluationRepositoryAdapter.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { accountingFxRepository } from "../repository/accountingFxRepositoryAdapter.js";
import {
  entryForSource,
  persistGeneratedEntry,
  resolveYearId,
} from "../ledgerPosting/ledgerPostingHelpers.js";
import type { FxRevaluationDeps } from "./fxRevaluationUseCases.js";
import type { FxReportDeps } from "./fxReportUseCases.js";

/** Production wiring: callers run inside one tenant transaction, so entries, run and audit commit together. */
export const fxRevaluationDeps: FxRevaluationDeps = {
  fx: accountingFxRepository,
  listBalances: store.listForeignMonetaryBalances,
  listRuns: (tenant) => store.listFxRevaluationRuns(tenant),
  findRunId: store.findFxRevaluationRunId,
  saveRun: store.saveFxRevaluationRun,
  getPostingRules: store.getPostingRules,
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

export const fxReportDeps: FxReportDeps = {
  fx: fxRevaluationDeps.fx,
  listBalances: fxRevaluationDeps.listBalances,
  listRuns: fxRevaluationDeps.listRuns,
  listRealized: store.listRealizedFxByCurrency,
};
