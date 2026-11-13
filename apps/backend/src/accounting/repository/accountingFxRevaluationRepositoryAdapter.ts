import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import {
  findFxRevaluationRunByDate,
  findFxRevaluationRunId,
  hasFxRevaluationBetween,
  listForeignMonetaryBalances,
  listFxRevaluationRuns,
  listFxRevaluationRunsBetween,
  saveFxRevaluationRun,
} from "../../db/repositories/accountingFxRevaluationRepository.js";
import { listRealizedFxByCurrency } from "../../db/repositories/accountingFxReportRepository.js";

/** Drizzle-backed storage for IAS 21 period-end revaluation (ports & adapters seam). */
export const accountingFxRevaluationRepository = {
  listForeignMonetaryBalances,
  listFxRevaluationRuns,
  listFxRevaluationRunsBetween,
  findFxRevaluationRunId,
  findFxRevaluationRunByDate,
  hasFxRevaluationBetween,
  saveFxRevaluationRun,
  getPostingRules,
  listFiscalYearsByWorkspace,
  listRealizedFxByCurrency,
};
